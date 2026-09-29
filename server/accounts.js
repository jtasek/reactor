import { createApi } from './api.js';
import { authHandler, createAuth, migrateAuth } from './auth.js';
import { openDatabase } from './database.js';
import { logMailer, smtpMailer } from './mailer.js';
import { migrateApp } from './migrations.js';

const required = (env, name) => {
    if (!env[name]) {
        throw new Error(`${name} is required when DATABASE_URL is set`);
    }

    return env[name];
};

/**
 * Starts accounts when `DATABASE_URL` is set: brings the account and app tables
 * up to date, and returns the handler to mount at `/api/auth/*splat`, before any
 * body parser, and the API to mount at `/api`. Without it, the editor is used signed out only. Production sends email
 * over SMTP; development without `SMTP_URL` writes it to the log.
 */
export async function startAccounts(env, { production, log }) {
    if (!env.DATABASE_URL) {
        return undefined;
    }

    const baseURL = required(env, 'BETTER_AUTH_URL');
    const secret = required(env, 'BETTER_AUTH_SECRET');

    if (production && !env.SMTP_URL) {
        throw new Error('SMTP_URL is required in production when DATABASE_URL is set');
    }

    const mailer = env.SMTP_URL
        ? smtpMailer(
              env.SMTP_URL,
              env.MAIL_FROM || `Reactor <no-reply@${new URL(baseURL).hostname}>`
          )
        : logMailer(log);
    const db = openDatabase(env.DATABASE_URL, log);
    const auth = createAuth({ db, baseURL, secret, mailer });

    try {
        await migrateAuth(auth);
        await migrateApp(db);
    } catch (error) {
        await db.destroy();
        throw error;
    }

    return {
        handler: authHandler(auth),
        api: createApi({ db, auth, origin: new URL(baseURL).origin }),
        close: () => db.destroy()
    };
}
