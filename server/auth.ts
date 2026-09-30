import { betterAuth } from 'better-auth';
import { getMigrations } from 'better-auth/db/migration';
import { toNodeHandler } from 'better-auth/node';
import { magicLink } from 'better-auth/plugins/magic-link';
import type { IncomingMessage, ServerResponse } from 'node:http';
import type { Mailer } from './mailer.ts';
import type { Db } from './schema.ts';

/** The header that carries the client's address, set only by `authHandler`. */
const CLIENT_ADDRESS = 'x-reactor-client-address';

/**
 * Accounts and sessions, stored in the `auth` schema of `db`. People sign up with
 * an email address, confirmed by a link before they can sign in with a password,
 * or sign in with a link sent by email. Sessions are only in the database, so
 * revoking one takes effect at once.
 */
export function createAuth({
    db,
    baseURL,
    secret,
    mailer
}: {
    db: Db;
    baseURL: string;
    secret: string;
    mailer: Mailer;
}) {
    return betterAuth({
        baseURL,
        basePath: '/api/auth',
        secret,
        database: { db, type: 'postgres', schemaName: 'auth' },
        session: { cookieCache: { enabled: false } },
        // Both are on in tests too, where Better Auth would otherwise skip them.
        rateLimit: { enabled: true },
        advanced: {
            disableOriginCheck: false,
            // Requests are limited per client, known only from `authHandler`.
            ipAddress: { ipAddressHeaders: [CLIENT_ADDRESS] }
        },
        emailAndPassword: { enabled: true, requireEmailVerification: true },
        emailVerification: {
            sendOnSignUp: true,
            autoSignInAfterVerification: true,
            sendVerificationEmail: ({ user, url }) =>
                mailer.send({
                    to: user.email,
                    subject: 'Confirm your email address',
                    text: `Confirm your email address to sign in to Reactor:\n\n${url}\n`
                })
        },
        plugins: [
            magicLink({
                sendMagicLink: ({ email, url }) =>
                    mailer.send({
                        to: email,
                        subject: 'Sign in to Reactor',
                        text: `Use this link to sign in to Reactor:\n\n${url}\n`
                    })
            })
        ]
    });
}

export type Auth = ReturnType<typeof createAuth>;

/** Creates or updates the account tables. */
export async function migrateAuth(auth: Auth) {
    const { runMigrations } = await getMigrations(auth.options);

    await runMigrations();
}

/**
 * Handles requests to `/api/auth` in Express, telling Better Auth the client's
 * address as Express resolved it, which follows `trust proxy`. A value the
 * client sent itself is overwritten, so it cannot pick its own rate limit.
 */
export function authHandler(auth: Auth) {
    const handle = toNodeHandler(auth);

    return (req: IncomingMessage & { ip?: string }, res: ServerResponse) => {
        req.headers[CLIENT_ADDRESS] = req.ip ?? req.socket.remoteAddress ?? '';

        return handle(req, res);
    };
}
