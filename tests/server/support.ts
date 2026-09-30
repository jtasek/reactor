import { PGlite } from '@electric-sql/pglite';
import express from 'express';
import type { AddressInfo } from 'net';
import { Kysely } from 'kysely';
import { PGliteDialect } from 'kysely-pglite-dialect';
import { createApi } from '../../server/api';
import { authHandler, createAuth, migrateAuth } from '../../server/auth';
import { migrateApp } from '../../server/migrations';
import { createSync } from '../../server/sync';

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
export const cookieHeader = (response: Response) =>
    response.headers
        .getSetCookie()
        .map((cookie) => cookie.split(';')[0])
        .join('; ');

/** The link in an email. */
export const findLink = ({ text }: Email) => {
    const link = /https?:\/\/\S+/.exec(text)?.[0];

    if (!link) {
        throw new Error(`No link in: ${text}`);
    }

    return link;
};

export interface Workspace {
    id: string;
    kind: string;
    name: string;
    role: string;
}

export interface DocumentSummary {
    id: string;
    name: string;
}

/** Sign-ins so far; each is a client of its own, as sign-in's rate limit is kept across tests. */
let clients = 0;

/**
 * Accounts, the API and document sync served over HTTP as the servers do, on an
 * empty database.
 */
export async function serve({ sessionCheck }: { sessionCheck?: number } = {}) {
    const accounts = await startAccounts();
    const app = express();
    const log = { error: () => {}, warn: () => {} };
    const sync = createSync({
        db: accounts.db,
        auth: accounts.auth,
        origin: ORIGIN,
        log,
        sessionCheck
    });

    app.all('/api/auth/*splat', authHandler(accounts.auth));
    app.use(
        '/api',
        createApi({
            db: accounts.db,
            auth: accounts.auth,
            origin: ORIGIN,
            onDeleted: sync.closeDocument
        })
    );

    const server = app.listen(0, '127.0.0.1');

    sync.attach(server);
    await new Promise((resolve) => server.once('listening', resolve));
    onTestFinished(async () => {
        await sync.close();
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

        return cookieHeader(await accounts.request(findLink(sent), { headers }));
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

    return { db: accounts.db, call, json, user, sync, syncURL: `ws://127.0.0.1:${port}/sync` };
}
