import { sql, type KyselyPlugin } from 'kysely';
import { createDocument } from '../../server/workspaces';
import { serve, type DocumentSummary } from './support';

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

        await sql`drop table documents cascade`.execute(db);

        const response = await call('GET', `/workspaces/${personal.id}/documents`, { cookie });

        expect(response.status).toBe(500);
        expect(await response.json()).toEqual({ code: 'INTERNAL' });
        expect(logged).toHaveBeenCalledOnce();
        logged.mockRestore();
    });

    it('creates a document with the id its client chose, once, and never one taken elsewhere', async () => {
        const { call, json, user } = await serve();
        const ada = await user('ada@example.com');
        const grace = await user('grace@example.com');
        const id = '0b7e2a4c-3f1d-4c8e-9a6b-2d5f8e1c7a90';
        const create = (cookie: string, workspaceId: string, body: object) =>
            call('POST', `/workspaces/${workspaceId}/documents`, { cookie, body });

        const first = await create(ada.cookie, ada.personal.id, { id, name: 'Plan' });

        expect(first.status).toBe(201);
        expect(await first.json()).toMatchObject({ id, name: 'Plan' });

        const again = await create(ada.cookie, ada.personal.id, { id, name: 'Plan' });

        expect(again.status).toBe(200);
        expect(await again.json()).toMatchObject({ id, name: 'Plan' });
        expect(
            await json(
                call('GET', `/workspaces/${ada.personal.id}/documents`, { cookie: ada.cookie })
            )
        ).toHaveLength(1);

        expect((await create(grace.cookie, grace.personal.id, { id, name: 'Mine' })).status).toBe(
            409
        );
        expect(
            (await create(ada.cookie, ada.personal.id, { id: 'not-a-uuid', name: 'Plan' })).status
        ).toBe(400);
    });

    it('creates a document again when it is deleted while its client retries', async () => {
        const { db, call, user } = await serve();
        const ada = await user('ada@example.com');
        const id = '5d2c9b1e-7a4f-4e3b-8c6d-1f0a9e8b7c65';

        await call('POST', `/workspaces/${ada.personal.id}/documents`, {
            cookie: ada.cookie,
            body: { id, name: 'Plan' }
        });

        const { created_by: userId } = await db
            .selectFrom('documents')
            .select('created_by')
            .$narrowType<{ created_by: string }>()
            .executeTakeFirstOrThrow();
        let deleting = true;
        // Deletes the document just after the retry finds it created.
        const deletedMeanwhile: KyselyPlugin = {
            transformQuery: ({ node }) => node,
            transformResult: async ({ result }) => {
                if (deleting && result.rows.length === 0) {
                    deleting = false;
                    await sql`delete from documents where id = ${id}`.execute(db);
                }

                return result;
            }
        };

        expect(
            await createDocument(db.withPlugin(deletedMeanwhile), {
                id,
                workspaceId: ada.personal.id,
                name: 'Plan',
                userId
            })
        ).toMatchObject({ document: { id, name: 'Plan' }, created: true });
    });
});
