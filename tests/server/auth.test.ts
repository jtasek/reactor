import { PGlite } from '@electric-sql/pglite';
import { Kysely, sql } from 'kysely';
import { PGliteDialect } from 'kysely-pglite-dialect';
import { createAuth, migrateAuth } from '../../server/auth';

const ORIGIN = 'http://localhost:4000';

interface Email {
    to: string;
    subject: string;
    text: string;
}

/** Accounts on an empty in-process database, with email kept in an outbox. */
async function startAccounts() {
    const db = new Kysely<unknown>({ dialect: new PGliteDialect(new PGlite()) });
    const outbox: Email[] = [];
    const auth = createAuth({
        db,
        baseURL: ORIGIN,
        secret: 'a test secret that is long enough to sign sessions',
        mailer: {
            send: async (email: Email) => {
                outbox.push(email);
            }
        }
    });

    await migrateAuth(auth);

    /** Sends a request as a browser on `origin` would, with the cookies it holds. */
    const request = (
        path: string,
        { body, cookie, origin = ORIGIN }: { body?: object; cookie?: string; origin?: string } = {}
    ) =>
        auth.handler(
            new Request(new URL(path, ORIGIN), {
                method: body ? 'POST' : 'GET',
                headers: {
                    origin,
                    ...(body ? { 'content-type': 'application/json' } : {}),
                    ...(cookie ? { cookie } : {})
                },
                body: body && JSON.stringify(body)
            })
        );

    return { db, auth, outbox, request };
}

/** The cookies a response sets, as a browser would send them back. */
const cookiesOf = (response: Response) =>
    response.headers
        .getSetCookie()
        .map((cookie) => cookie.split(';')[0])
        .join('; ');

/** The link in an email. */
const linkIn = ({ text }: Email) => {
    const link = /https?:\/\/\S+/.exec(text)?.[0];

    if (!link) {
        throw new Error(`No link in: ${text}`);
    }

    return link;
};

const sessionOf = async (
    request: Awaited<ReturnType<typeof startAccounts>>['request'],
    cookie: string
) => {
    const response = await request('/api/auth/get-session', { cookie });

    return (await response.json()) as { user: { email: string } } | null;
};

const account = { email: 'ada@example.com', password: 'correct horse battery', name: 'Ada' };

describe('accounts', () => {
    it('signs in with a password only once the email address is confirmed', async () => {
        const { request, outbox } = await startAccounts();

        expect((await request('/api/auth/sign-up/email', { body: account })).ok).toBe(true);
        expect(outbox).toHaveLength(1);
        expect(outbox[0].to).toBe(account.email);

        const early = await request('/api/auth/sign-in/email', { body: account });

        expect(early.status).toBe(403);

        const confirmed = await request(linkIn(outbox[0]));
        const cookie = cookiesOf(confirmed);

        expect((await sessionOf(request, cookie))?.user.email).toBe(account.email);

        const signedIn = await request('/api/auth/sign-in/email', { body: account });

        expect(signedIn.ok).toBe(true);
        expect((await sessionOf(request, cookiesOf(signedIn)))?.user.email).toBe(account.email);
    });

    it('signs in with a link sent by email', async () => {
        const { request, outbox } = await startAccounts();

        expect(
            (await request('/api/auth/sign-in/magic-link', { body: { email: account.email } })).ok
        ).toBe(true);
        expect(outbox).toHaveLength(1);

        const cookie = cookiesOf(await request(linkIn(outbox[0])));

        expect((await sessionOf(request, cookie))?.user.email).toBe(account.email);
    });

    it('ends the session at once when signing out', async () => {
        const { request, outbox } = await startAccounts();

        await request('/api/auth/sign-in/magic-link', { body: { email: account.email } });

        const cookie = cookiesOf(await request(linkIn(outbox[0])));

        expect((await request('/api/auth/sign-out', { body: {}, cookie })).ok).toBe(true);
        expect(await sessionOf(request, cookie)).toBeNull();
    });

    it('refuses a request from another site that carries the session', async () => {
        const { request, outbox } = await startAccounts();

        await request('/api/auth/sign-in/magic-link', { body: { email: account.email } });

        const cookie = cookiesOf(await request(linkIn(outbox[0])));
        const response = await request('/api/auth/sign-out', {
            body: {},
            cookie,
            origin: 'https://attacker.example'
        });

        expect(response.status).toBe(403);
        expect((await sessionOf(request, cookie))?.user.email).toBe(account.email);
    });

    it('keeps its tables in the auth schema', async () => {
        const { db } = await startAccounts();
        const { rows } = await sql<{ table_name: string }>`
            select table_name from information_schema.tables
            where table_schema = 'auth' order by table_name`.execute(db);

        expect(rows.map(({ table_name }) => table_name)).toEqual(
            expect.arrayContaining(['account', 'session', 'user', 'verification'])
        );
    });
});
