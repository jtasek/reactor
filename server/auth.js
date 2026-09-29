import { betterAuth } from 'better-auth';
import { getMigrations } from 'better-auth/db/migration';
import { magicLink } from 'better-auth/plugins/magic-link';

/**
 * Accounts and sessions, stored in the `auth` schema of `db`. People sign up with
 * an email address, confirmed by a link before they can sign in with a password,
 * or sign in with a link sent by email. Sessions are only in the database, so
 * revoking one takes effect at once.
 */
export function createAuth({ db, baseURL, secret, mailer }) {
    return betterAuth({
        baseURL,
        basePath: '/api/auth',
        secret,
        database: { db, type: 'postgres', schemaName: 'auth' },
        session: { cookieCache: { enabled: false } },
        // Checked in tests too, where Better Auth would otherwise skip it.
        advanced: { disableOriginCheck: false },
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

/** Creates or updates the account tables. */
export async function migrateAuth(auth) {
    const { runMigrations } = await getMigrations(auth.options);

    await runMigrations();
}
