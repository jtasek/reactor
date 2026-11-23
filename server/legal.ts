import express from 'express';
import { sql } from 'kysely';
import type { Db } from './schema.ts';
import { LEGAL_VERSION } from '../src/shared/legal.ts';

/**
 * The Terms and Privacy policy version the signed-in user agreed to, and agreeing
 * to the current one. Accounts made before the terms, or before they changed, have
 * an older version or none, and the editor asks them once.
 */
export function legalAgreement(db: Db) {
    const router = express.Router();

    router.get('/legal', async (req, res) => {
        const { rows } = await sql<{ legalVersion: string | null }>`
            select "legalVersion" from auth."user" where id = ${req.userId}`.execute(db);

        res.set('Cache-Control', 'no-store');
        res.json({ version: LEGAL_VERSION, agreed: rows[0]?.legalVersion ?? null });
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
