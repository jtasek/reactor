import express, { type RequestHandler } from 'express';
import { sql } from 'kysely';
import type { Db } from './schema.ts';
import { LEGAL_VERSION } from '../src/shared/legal.ts';

const agreedVersion = async (db: Db, userId: string) =>
    (
        await sql<{ legalVersion: string | null }>`
            select "legalVersion" from auth."user" where id = ${userId}`.execute(db)
    ).rows[0]?.legalVersion ?? null;

/** Whether the account agreed to the current terms; until then the server refuses its requests. */
export const agreedToTerms = async (db: Db, userId: string) =>
    (await agreedVersion(db, userId)) === LEGAL_VERSION;

/** Refuses the signed-in request of an account that has not agreed to the current terms. */
export const requireTerms =
    (db: Db): RequestHandler =>
    async (req, res, next) => {
        if (await agreedToTerms(db, req.userId)) {
            return next();
        }

        res.status(403).json({ code: 'TERMS_REQUIRED', version: LEGAL_VERSION });
    };

/**
 * The Terms and Privacy policy version the signed-in user agreed to, and agreeing
 * to the current one. Accounts made before the terms, or before they changed, have
 * an older version or none, and the editor asks them once.
 */
export function legalAgreement(db: Db) {
    const router = express.Router();

    router.get('/legal', async (req, res) => {
        const agreed = await agreedVersion(db, req.userId);

        res.set('Cache-Control', 'no-store');
        res.json({ version: LEGAL_VERSION, agreed });
    });

    // The version the person read is sent, so terms that changed meanwhile are not agreed to unread.
    router.post('/legal', async (req, res) => {
        if (req.body?.version !== LEGAL_VERSION) {
            return res.status(409).json({ code: 'LEGAL_VERSION_CHANGED', version: LEGAL_VERSION });
        }

        await sql`
            update auth."user" set "legalVersion" = ${LEGAL_VERSION}, "legalAcceptedAt" = now()
            where id = ${req.userId}`.execute(db);

        return res.status(204).end();
    });

    return router;
}
