import { PGlite } from '@electric-sql/pglite';
import express from 'express';
import type { AddressInfo } from 'net';
import { Kysely, PostgresDialect, type KyselyPlugin } from 'kysely';
import { PGliteDialect } from 'kysely-pglite-dialect';
import pg from 'pg';
import type { AiLimits } from '../../server/ai';
import type { AiProvider } from '../../server/aiTasks';
import { createApi } from '../../server/api';
import { authHandler, createAuth, migrateAuth } from '../../server/auth';
import { migrateApp } from '../../server/migrations';
import type { Database } from '../../server/schema';
import { createSync } from '../../server/sync';
import {
    browserErrors,
    createMetrics,
    metricsRoutes,
    type BrowserErrorLimits
} from '../../server/metrics';
import {
    betaMeasures,
    firstSharedLinks,
    sharedPrototypes
} from '../../server/repositories/prototypeLinks';
import { BETA_MEASURES } from '../../server/services/prototypeLinks';
import { SCHEMA_VERSION } from '../../src/shared/schemaVersion';

export const ORIGIN = 'http://localhost:4000';

const SECRET = 'a test secret that is long enough to sign sessions';

// Each test starts PostgreSQL in the test process, which takes seconds on a busy machine.
vi.setConfig({ testTimeout: 20_000 });

/**
 * Each test takes a copy of one empty database with its tables made, as making
 * them takes far longer, up to half a minute on a busy machine. They are made
 * before a file's tests, within this time rather than the first test's.
 */
const EMPTY_DATABASE_TIMEOUT = 120_000;

/**
 * With `TEST_DATABASE_URL`, tests run on that PostgreSQL server instead of in the
 * test process (the nightly run): each test takes its own copy of a database whose
 * tables a file's tests make once, and the copies are dropped afterwards.
 */
const SERVER_URL = process.env.TEST_DATABASE_URL;

let emptyDatabase: Blob;
let template: string | undefined;
const databases: { name: string; db: Kysely<Database> }[] = [];

const uniqueName = (prefix: string) =>
    `${prefix}_${process.pid}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;

const databaseURL = (name: string) => {
    const url = new URL(SERVER_URL!);

    url.pathname = `/${name}`;

    return url.toString();
};

const openServerDatabase = (name: string, plugins: KyselyPlugin[] = []) => {
    const pool = new pg.Pool({
        connectionString: databaseURL(name),
        max: 4,
        idleTimeoutMillis: 500
    });

    // Dropping the database ends its connections, which the pool reports here.
    pool.on('error', () => {});

    return new Kysely<Database>({ dialect: new PostgresDialect({ pool }), plugins });
};

/** Runs `statement` on the server's own database, outside any test's. */
async function administer(statement: string) {
    const client = new pg.Client({ connectionString: SERVER_URL });

    await client.connect();

    try {
        await client.query(statement);
    } finally {
        await client.end();
    }
}

async function makeTables(db: Kysely<Database>) {
    await migrateAuth(
        createAuth({ db, baseURL: ORIGIN, secret: SECRET, mailer: { send: async () => {} } })
    );
    await migrateApp(db);
}

beforeAll(async () => {
    if (SERVER_URL) {
        template = uniqueName('reactor_template');
        await administer(`CREATE DATABASE ${template}`);

        const db = openServerDatabase(template);

        await makeTables(db);
        await db.destroy();

        return;
    }

    const pglite = new PGlite();
    const db = new Kysely<Database>({ dialect: new PGliteDialect(pglite) });

    await makeTables(db);
    emptyDatabase = await pglite.dumpDataDir('none');
    await pglite.close();
}, EMPTY_DATABASE_TIMEOUT);

/**
 * Drops every database this file made, ending connections a test left open (a pool
 * waits for those forever), then closes the pools.
 */
afterAll(async () => {
    const made = databases.splice(0);

    for (const name of made.map(({ name }) => name).concat(template ?? [])) {
        await administer(`DROP DATABASE IF EXISTS ${name} WITH (FORCE)`);
    }

    await Promise.allSettled(made.map(({ db }) => db.destroy()));
}, EMPTY_DATABASE_TIMEOUT);

/** An empty database with the app's tables, for one test or a file's tests. */
async function emptyCopy(plugins: KyselyPlugin[]) {
    if (!template) {
        return new Kysely<Database>({
            dialect: new PGliteDialect(new PGlite({ loadDataDir: emptyDatabase })),
            plugins
        });
    }

    const name = uniqueName('reactor_test');

    await administer(`CREATE DATABASE ${name} TEMPLATE ${template}`);

    const db = openServerDatabase(name, plugins);

    databases.push({ name, db });

    return db;
}

export interface Email {
    to: string;
    subject: string;
    text: string;
}

/** Accounts on an empty in-process database, with email kept in an outbox. */
export async function startAccounts(
    plugins: KyselyPlugin[] = [],
    socialProviders?: Parameters<typeof createAuth>[0]['socialProviders'],
    connections?: Parameters<typeof createAuth>[0]['connections']
) {
    const db = await emptyCopy(plugins);
    const outbox: Email[] = [];
    const auth = createAuth({
        db,
        baseURL: ORIGIN,
        secret: SECRET,
        socialProviders,
        connections,
        mailer: {
            send: async (email: Email) => {
                outbox.push(email);
            }
        }
    });

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
    ai: boolean;
}

export interface DocumentSummary {
    id: string;
    name: string;
}

const contentType = (body: unknown) =>
    body instanceof Uint8Array ? 'application/octet-stream' : 'application/json';

/** A blob for bytes, which fetch can send again when the answer is 401, as a browser does. */
const sentBody = (body: unknown) => {
    if (body === undefined) {
        return undefined;
    }

    return body instanceof Uint8Array ? new Blob([new Uint8Array(body)]) : JSON.stringify(body);
};

/** Sign-ins so far; each is a client of its own, as sign-in's rate limit is kept across tests. */
let clients = 0;

export interface ServeOptions {
    previewOrigin?: string;
    socialProviders?: Parameters<typeof createAuth>[0]['socialProviders'];
    databasePlugins?: KyselyPlugin[];
    sessionCheck?: number;
    /** The document format of the editor the sync server serves, or how to read it. */
    editorVersion?: number | (() => number);
    /** The server's clock, for snapshots, saves and deletions. */
    now?: () => Date;
    assetQuota?: number;
    /** Where AI requests go, and their limits; without it, AI is off. */
    ai?: { provider: AiProvider; limits?: AiLimits };
    /** The bearer token `/metrics` takes; without it, there are no metrics routes. */
    metricsToken?: string;
    browserErrorLimits?: BrowserErrorLimits;
    /** Where browser error reports are logged. */
    log?: { warn: (...args: unknown[]) => void };
}

/**
 * Accounts, the API and document sync served over HTTP as the servers do, on an
 * empty database, until the test ends.
 */
export async function serve(options: ServeOptions = {}) {
    const served = await startServer(options);

    onTestFinished(served.close);

    return served;
}

/** As `serve`, until `close` is called, so one server may last for several tests. */
export async function startServer({
    socialProviders,
    previewOrigin,
    sessionCheck,
    editorVersion,
    now,
    assetQuota,
    ai,
    databasePlugins,
    metricsToken,
    browserErrorLimits,
    log: browserLog = { warn: () => {} }
}: ServeOptions = {}) {
    const accounts = await startAccounts(databasePlugins, socialProviders, () => sync);
    const app = express();
    const log = { error: () => {}, warn: () => {} };
    const metrics = createMetrics();
    const sync = createSync({
        metrics,
        db: accounts.db,
        auth: accounts.auth,
        origin: ORIGIN,
        log,
        sessionCheck,
        editorVersion,
        now
    });

    app.use(
        metricsRoutes({
            token: metricsToken,
            metrics,
            prototypes: () => sharedPrototypes(accounts.db),
            firstLinks: () => firstSharedLinks(accounts.db),
            beta: () => betaMeasures(accounts.db, { ...BETA_MEASURES, now: now?.() ?? new Date() })
        })
    );
    app.use(browserErrors({ metrics, log: browserLog, limits: browserErrorLimits }));
    app.all('/api/auth/*splat', authHandler(accounts.auth));
    app.use(
        '/api',
        createApi({
            metrics,
            db: accounts.db,
            auth: accounts.auth,
            origin: ORIGIN,
            onDeleted: sync.closeDocument,
            onAccessChanged: sync.closeMember,
            history: sync,
            now,
            log,
            assetQuota,
            previewOrigin,
            ai
        })
    );

    const server = app.listen(0, '127.0.0.1');

    sync.attach(server);
    await new Promise((resolve) => server.once('listening', resolve));

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

    /**
     * Calls the API as a browser on this site would, or with other `headers`. A
     * `body` of bytes is sent as it is; any other as JSON.
     */
    const call = (
        method: string,
        path: string,
        {
            cookie,
            body,
            headers = {},
            signal
        }: {
            cookie?: string;
            body?: unknown;
            headers?: Record<string, string>;
            signal?: AbortSignal;
        } = {}
    ) =>
        fetch(`http://127.0.0.1:${port}/api${path}`, {
            method,
            signal,
            headers: {
                origin: ORIGIN,
                ...(body === undefined ? {} : { 'content-type': contentType(body) }),
                ...(cookie ? { cookie } : {}),
                ...headers
            },
            body: sentBody(body)
        });

    const json = async <T>(response: Promise<Response>) => (await (await response).json()) as T;

    /** Signs `email` in and returns their cookie and personal workspace. */
    const user = async (email: string) => {
        const cookie = await signIn(email);
        const [personal] = await json<Workspace[]>(call('GET', '/workspaces', { cookie }));

        return { cookie, personal };
    };

    return {
        db: accounts.db,
        outbox: accounts.outbox,
        metrics,
        address: `http://127.0.0.1:${port}`,
        call,
        json,
        user,
        sync,
        syncURL: `ws://127.0.0.1:${port}/sync?editor=${SCHEMA_VERSION}`,
        close: async () => {
            await sync.close();
            server.close();
        }
    };
}
