import { PGlite } from '@electric-sql/pglite';
import { Kysely } from 'kysely';
import { PGliteDialect } from 'kysely-pglite-dialect';
import { createAuth, migrateAuth } from '../../server/auth';
import { migrateApp } from '../../server/migrations';

export const ORIGIN = 'http://localhost:4000';

export interface Email {
    to: string;
    subject: string;
    text: string;
}

/** Accounts on an empty in-process database, with email kept in an outbox. */
export async function startAccounts() {
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
    await migrateApp(db);

    /** Sends a request as a browser on `origin` would, with the cookies it holds. */
    const request = (
        path: string,
        {
            body,
            cookie,
            origin = ORIGIN,
            headers = {}
        }: {
            body?: object;
            cookie?: string;
            origin?: string;
            headers?: Record<string, string>;
        } = {}
    ) =>
        auth.handler(
            new Request(new URL(path, ORIGIN), {
                method: body ? 'POST' : 'GET',
                headers: {
                    origin,
                    ...(body ? { 'content-type': 'application/json' } : {}),
                    ...(cookie ? { cookie } : {}),
                    ...headers
                },
                body: body && JSON.stringify(body)
            })
        );

    return { db, auth, outbox, request };
}

/** The cookies a response sets, as a browser would send them back. */
export const cookiesOf = (response: Response) =>
    response.headers
        .getSetCookie()
        .map((cookie) => cookie.split(';')[0])
        .join('; ');

/** The link in an email. */
export const linkIn = ({ text }: Email) => {
    const link = /https?:\/\/\S+/.exec(text)?.[0];

    if (!link) {
        throw new Error(`No link in: ${text}`);
    }

    return link;
};
