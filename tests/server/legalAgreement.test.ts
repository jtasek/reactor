import { sql } from 'kysely';
import { LEGAL_VERSION } from '../../src/shared/legal';
import { cookieHeader, findLink, startAccounts } from './support';

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
});
