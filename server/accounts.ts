import { configuresAi, providerFromEnv } from './ai.ts';
import { createApi } from './api.ts';
import { UNUSED_ASSET_GRACE_MS, deleteUnusedAssets, postgresBlobs } from './assets.ts';
import { authHandler, createAuth, migrateAuth } from './auth.ts';
import { socialProvidersFromEnv } from './oauth.ts';
import { openDatabase } from './database.ts';
import { logMailer, smtpMailer } from './mailer.ts';
import { migrateApp } from './migrations.ts';
import type { Log } from './schema.ts';
import { createSync } from './sync.ts';

const required = (env: NodeJS.ProcessEnv, name: string) => {
    if (!env[name]) {
        throw new Error(`${name} is required when DATABASE_URL is set`);
    }

    return env[name];
};

/**
 * Starts accounts when `DATABASE_URL` is set: brings the account and app tables
 * up to date, and returns the handler to mount at `/api/auth/*splat`, before any
 * body parser, the API to mount at `/api`, and the document sync to attach to the
 * HTTP server. On shutdown, close the sync first, then the rest once it is done. Without it, the editor is used signed out only. With `AI_PROVIDER`, the API's `/ai` gateway is on (`providerFromEnv`). Production sends email
 * over SMTP; development without `SMTP_URL` writes it to the log.
 */
/** How often images no document uses are looked for and deleted, the first time soon after start. */
const ASSET_CLEANUP_INTERVAL_MS = 60 * 60 * 1000;
const FIRST_ASSET_CLEANUP_MS = 60 * 1000;

export async function startAccounts(
    env: NodeJS.ProcessEnv,
    { production, log }: { production: boolean; log: Log }
) {
    if (!env.DATABASE_URL) {
        return undefined;
    }

    const baseURL = required(env, 'BETTER_AUTH_URL');
    const secret = required(env, 'BETTER_AUTH_SECRET');

    if (production && !env.SMTP_URL) {
        throw new Error('SMTP_URL is required in production when DATABASE_URL is set');
    }

    const socialProviders = socialProvidersFromEnv(env);
    const ai = configuresAi(env) ? { provider: providerFromEnv(env) } : undefined;
    const mailer = env.SMTP_URL
        ? smtpMailer(
              env.SMTP_URL,
              env.MAIL_FROM || `Reactor <no-reply@${new URL(baseURL).hostname}>`
          )
        : logMailer(log);
    const db = openDatabase(env.DATABASE_URL, log);
    const auth = createAuth({ db, baseURL, secret, mailer, socialProviders });

    try {
        await migrateAuth(auth);
        await migrateApp(db);
    } catch (error) {
        await db.destroy();
        throw error;
    }

    const origin = new URL(baseURL).origin;
    const sync = createSync({ db, auth, origin, log });
    const blobs = postgresBlobs(db);
    const cleanUp = () =>
        deleteUnusedAssets(db, blobs, new Date(Date.now() - UNUSED_ASSET_GRACE_MS)).catch(
            (error: unknown) => log.error(error)
        );
    // Soon after start as well, so a server restarted within the hour still cleans up.
    const firstCleanup = setTimeout(cleanUp, FIRST_ASSET_CLEANUP_MS);
    const cleanups = setInterval(cleanUp, ASSET_CLEANUP_INTERVAL_MS);

    // Neither keeps the process running.
    firstCleanup.unref();
    cleanups.unref();

    return {
        handler: authHandler(auth),
        api: createApi({
            db,
            auth,
            origin,
            onDeleted: sync.closeDocument,
            onAccessChanged: sync.closeMember,
            blobs,
            ai
        }),
        sync,
        close: () => {
            clearTimeout(firstCleanup);
            clearInterval(cleanups);

            return db.destroy();
        }
    };
}
