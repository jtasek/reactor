import express from 'express';
import { sql } from 'kysely';
import type { AddressInfo } from 'net';
import { createApi } from '../../server/api';
import { authHandler } from '../../server/auth';
import { ORIGIN, cookiesOf, linkIn, startAccounts } from './support';

interface Workspace {
    id: string;
    kind: string;
    name: string;
    role: string;
}

interface DocumentSummary {
    id: string;
    name: string;
}

/** Sign-ins so far; each is a client of its own, as sign-in's rate limit is kept across tests. */
let clients = 0;

/** The API and accounts served over HTTP as the servers do, on an empty database. */
async function serve() {
    const accounts = await startAccounts();
    const app = express();

    app.all('/api/auth/*splat', authHandler(accounts.auth));
    app.use('/api', createApi({ db: accounts.db, auth: accounts.auth, origin: ORIGIN }));

    const server = app.listen(0, '127.0.0.1');

    await new Promise((resolve) => server.once('listening', resolve));
    onTestFinished(() => {
        server.close();
    });

    const { port } = server.address() as AddressInfo;

    /**
     * Signs `email` in with an emailed link, as a client of its own so sign-in's
     * rate limit is not reached; returns the session cookie.
     */
    const signIn = async (email: string) => {
        clients++;

        const headers = { 'x-reactor-client-address': `198.18.0.${clients}` };

        await accounts.request('/api/auth/sign-in/magic-link', { body: { email }, headers });

        const sent = accounts.outbox.filter(({ to }) => to === email).at(-1);

        if (!sent) {
            throw new Error(`No sign-in link was sent to ${email}`);
        }

        return cookiesOf(await accounts.request(linkIn(sent), { headers }));
    };

    /** Calls the API as a browser on this site would, or with other `headers`. */
    const call = (
        method: string,
        path: string,
        {
            cookie,
            body,
            headers = {}
        }: { cookie?: string; body?: unknown; headers?: Record<string, string> } = {}
    ) =>
        fetch(`http://127.0.0.1:${port}/api${path}`, {
            method,
            headers: {
                origin: ORIGIN,
                ...(body === undefined ? {} : { 'content-type': 'application/json' }),
                ...(cookie ? { cookie } : {}),
                ...headers
            },
            body: body === undefined ? undefined : JSON.stringify(body)
        });

    const json = async <T>(response: Promise<Response>) => (await (await response).json()) as T;

    /** Signs `email` in and returns their cookie and personal workspace. */
    const user = async (email: string) => {
        const cookie = await signIn(email);
        const [personal] = await json<Workspace[]>(call('GET', '/workspaces', { cookie }));

        return { cookie, personal };
    };

    return { db: accounts.db, call, json, user };
}

describe('API', () => {
    it('answers nobody signed out', async () => {
        const { call } = await serve();

        expect((await call('GET', '/workspaces')).status).toBe(401);
        expect(
            (await call('POST', '/workspaces/any/documents', { body: { name: 'A' } })).status
        ).toBe(401);
    });

    it('gives each user one personal workspace, which they administer', async () => {
        const { call, json, user } = await serve();
        const { cookie, personal } = await user('ada@example.com');

        expect(personal).toEqual({
            id: expect.any(String),
            kind: 'personal',
            name: 'Personal',
            role: 'admin'
        });
        expect(await json(call('GET', '/workspaces', { cookie }))).toEqual([personal]);
    });

    it('creates, lists and deletes documents in a workspace', async () => {
        const { call, json, user } = await serve();
        const { cookie, personal } = await user('ada@example.com');
        const documents = `/workspaces/${personal.id}/documents`;

        const created = await call('POST', documents, { cookie, body: { name: '  Plan  ' } });

        expect(created.status).toBe(201);

        const plan = (await created.json()) as DocumentSummary;

        expect(plan).toMatchObject({ name: 'Plan' });
        expect(await json(call('GET', documents, { cookie }))).toEqual([
            expect.objectContaining({ id: plan.id, name: 'Plan' })
        ]);

        for (const name of ['', '   ', 'x'.repeat(201), 42]) {
            expect((await call('POST', documents, { cookie, body: { name } })).status).toBe(400);
        }

        expect((await call('DELETE', `/documents/${plan.id}`, { cookie })).status).toBe(204);
        expect(await json(call('GET', documents, { cookie }))).toEqual([]);
    });

    it('answers as missing what another user may not read', async () => {
        const { call, json, user } = await serve();
        const ada = await user('ada@example.com');
        const grace = await user('grace@example.com');
        const plan = await json<DocumentSummary>(
            call('POST', `/workspaces/${ada.personal.id}/documents`, {
                cookie: ada.cookie,
                body: { name: 'Plan' }
            })
        );

        expect(
            (
                await call('GET', `/workspaces/${ada.personal.id}/documents`, {
                    cookie: grace.cookie
                })
            ).status
        ).toBe(404);
        expect(
            (
                await call('POST', `/workspaces/${ada.personal.id}/documents`, {
                    cookie: grace.cookie,
                    body: { name: 'Intrusion' }
                })
            ).status
        ).toBe(404);
        expect(
            (await call('DELETE', `/documents/${plan.id}`, { cookie: grace.cookie })).status
        ).toBe(404);
        expect(
            await json(
                call('GET', `/workspaces/${ada.personal.id}/documents`, { cookie: ada.cookie })
            )
        ).toHaveLength(1);
    });

    it('lets viewers read, editors create, and only admins delete', async () => {
        const { db, call, json, user } = await serve();
        const ada = await user('ada@example.com');
        const grace = await user('grace@example.com');
        const documents = `/workspaces/${ada.personal.id}/documents`;
        const plan = await json<DocumentSummary>(
            call('POST', documents, { cookie: ada.cookie, body: { name: 'Plan' } })
        );
        const { rows } = await sql<{ id: string }>`
            select id from auth.user where email = 'grace@example.com'`.execute(db);
        const joinAs = (role: string) =>
            sql`insert into workspace_members (workspace_id, user_id, role)
                values (${ada.personal.id}, ${rows[0].id}, ${role})
                on conflict (workspace_id, user_id) do update set role = excluded.role`.execute(db);

        await joinAs('viewer');
        expect(await json(call('GET', documents, { cookie: grace.cookie }))).toHaveLength(1);
        expect(
            (await call('POST', documents, { cookie: grace.cookie, body: { name: 'Mine' } })).status
        ).toBe(403);
        expect(
            (await call('DELETE', `/documents/${plan.id}`, { cookie: grace.cookie })).status
        ).toBe(403);

        await joinAs('editor');
        expect(
            (await call('POST', documents, { cookie: grace.cookie, body: { name: 'Mine' } })).status
        ).toBe(201);
        expect(
            (await call('DELETE', `/documents/${plan.id}`, { cookie: grace.cookie })).status
        ).toBe(403);
    });

    it('refuses changes from another site, and bodies that are not JSON', async () => {
        const { call, json, user } = await serve();
        const { cookie, personal } = await user('ada@example.com');
        const documents = `/workspaces/${personal.id}/documents`;

        expect(
            (
                await call('POST', documents, {
                    cookie,
                    body: { name: 'Plan' },
                    headers: { origin: 'https://attacker.example' }
                })
            ).status
        ).toBe(403);
        expect(
            (
                await call('POST', documents, {
                    cookie,
                    body: 'name=Plan',
                    headers: { 'content-type': 'text/plain' }
                })
            ).status
        ).toBe(415);
        expect(
            (
                await call('POST', documents, {
                    cookie,
                    headers: { 'content-type': 'application/json' },
                    body: undefined
                })
            ).status
        ).toBe(400);
        expect(
            (
                await call('POST', documents, {
                    cookie,
                    body: { name: 'Plan' },
                    headers: { 'content-type': 'application/json; charset=latin1' }
                })
            ).status
        ).toBe(415);
        expect(await json(call('GET', documents, { cookie }))).toEqual([]);
    });

    it('logs a failure it did not expect, and answers it without detail', async () => {
        const { db, call, user } = await serve();
        const { cookie, personal } = await user('ada@example.com');
        const logged = vi.spyOn(console, 'error').mockImplementation(() => {});

        await sql`drop table documents`.execute(db);

        const response = await call('GET', `/workspaces/${personal.id}/documents`, { cookie });

        expect(response.status).toBe(500);
        expect(await response.json()).toEqual({ code: 'INTERNAL' });
        expect(logged).toHaveBeenCalledOnce();
        logged.mockRestore();
    });
});
