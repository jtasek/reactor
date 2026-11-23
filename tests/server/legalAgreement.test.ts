import { sql } from 'kysely';
import WebSocket from 'ws';
import { LEGAL_VERSION } from '../../src/shared/legal';
import { ORIGIN, cookieHeader, findLink, serve, startAccounts } from './support';

const agreement = async (db: Awaited<ReturnType<typeof startAccounts>>['db'], email: string) =>
    (
        await sql<{
            legalVersion: string | null;
            legalAcceptedAt: Date | null;
        }>`select "legalVersion", "legalAcceptedAt" from auth."user" where email = ${email}`.execute(
            db
        )
    ).rows[0];

describe('agreeing to the Terms and Privacy policy', () => {
    it('records the version each new account agreed to, whichever way it signed up', async () => {
        const { db, request, outbox } = await startAccounts();
        const before = Date.now();

        await request('/api/auth/sign-up/email', {
            body: { email: 'ada@example.com', password: 'correct horse battery', name: 'Ada' }
        });
        await request('/api/auth/sign-in/magic-link', { body: { email: 'grace@example.com' } });
        await request(findLink(outbox[1]));

        for (const email of ['ada@example.com', 'grace@example.com']) {
            const { legalVersion, legalAcceptedAt } = await agreement(db, email);

            expect(legalVersion).toBe(LEGAL_VERSION);
            expect(legalAcceptedAt?.getTime()).toBeGreaterThanOrEqual(before - 1000);
        }
    });

    it('refuses a version the request names itself and keeps it out of the session', async () => {
        const { db, request, outbox } = await startAccounts();
        const ada = { email: 'ada@example.com', password: 'correct horse battery', name: 'Ada' };

        const named = await request('/api/auth/sign-up/email', {
            body: { ...ada, legalVersion: '1999-01-01' }
        });

        expect(named.status).toBe(400);
        expect(await agreement(db, ada.email)).toBeUndefined();

        await request('/api/auth/sign-up/email', { body: ada });

        const cookie = cookieHeader(await request(findLink(outbox[0])));
        const session = (await (await request('/api/auth/get-session', { cookie })).json()) as {
            user: object;
        };

        expect(session.user).not.toHaveProperty('legalVersion');
        expect(session.user).not.toHaveProperty('legalAcceptedAt');
    });

    it('asks accounts without the current version, and records it once agreed', async () => {
        const { db, call, json, user } = await serve();
        const { cookie } = await user('ada@example.com');

        expect(await json(call('GET', '/legal', { cookie }))).toEqual({
            version: LEGAL_VERSION,
            agreed: LEGAL_VERSION
        });

        await sql`update auth."user" set "legalVersion" = null, "legalAcceptedAt" = null`.execute(
            db
        );

        expect(await json(call('GET', '/legal', { cookie }))).toEqual({
            version: LEGAL_VERSION,
            agreed: null
        });

        const before = Date.now();
        const agreed = await call('POST', '/legal', { cookie, body: { version: LEGAL_VERSION } });

        expect(agreed.status).toBe(204);

        const { legalVersion, legalAcceptedAt } = await agreement(db, 'ada@example.com');

        expect(legalVersion).toBe(LEGAL_VERSION);
        expect(legalAcceptedAt?.getTime()).toBeGreaterThanOrEqual(before - 1000);
    });

    it('refuses agreeing to another version, from another site or signed out', async () => {
        const { db, call, user } = await serve();
        const { cookie } = await user('ada@example.com');

        await sql`update auth."user" set "legalVersion" = null`.execute(db);

        const stale = await call('POST', '/legal', { cookie, body: { version: '1999-01-01' } });

        expect(stale.status).toBe(409);
        expect(await stale.json()).toEqual({
            code: 'LEGAL_VERSION_CHANGED',
            version: LEGAL_VERSION
        });

        const elsewhere = await call('POST', '/legal', {
            cookie,
            body: { version: LEGAL_VERSION },
            headers: { origin: 'https://elsewhere.example' }
        });

        expect(elsewhere.status).toBe(403);
        expect((await call('POST', '/legal', { body: { version: LEGAL_VERSION } })).status).toBe(
            401
        );
        expect((await agreement(db, 'ada@example.com')).legalVersion).toBeNull();
    });

    it('refuses every other request and sync from an account until it agrees', async () => {
        const { db, call, json, user, syncURL } = await serve();
        const { cookie, personal } = await user('ada@example.com');
        const syncs = () =>
            new Promise<number>((resolve) => {
                const socket = new WebSocket(syncURL, { headers: { origin: ORIGIN, cookie } });

                socket.on('unexpected-response', (_request, response) =>
                    resolve(response.statusCode ?? 0)
                );
                socket.on('open', () => {
                    socket.close();
                    resolve(101);
                });
            });
        const requests = () => [
            call('GET', '/workspaces', { cookie }),
            call('POST', `/workspaces/${personal.id}/documents`, {
                cookie,
                body: { name: 'Plan' }
            }),
            call('POST', '/ai/edit', { cookie, body: {} })
        ];

        await sql`update auth."user" set "legalVersion" = '1999-01-01'`.execute(db);

        for (const refused of await Promise.all(requests())) {
            expect(refused.status).toBe(403);
            expect(await refused.json()).toEqual({
                code: 'TERMS_REQUIRED',
                version: LEGAL_VERSION
            });
        }

        expect(await syncs()).toBe(403);
        expect((await call('GET', '/legal', { cookie })).status).toBe(200);

        await call('POST', '/legal', { cookie, body: { version: LEGAL_VERSION } });

        const [workspaces, created] = await Promise.all(requests());

        expect(workspaces.status).toBe(200);
        expect(created.status).toBe(201);
        expect(await syncs()).toBe(101);
        expect(await json(call('GET', '/workspaces', { cookie }))).toHaveLength(1);
    });
});
