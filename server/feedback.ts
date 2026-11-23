import express from 'express';
import { randomUUID } from 'node:crypto';
import { sql } from 'kysely';
import { FEEDBACK_MAX_LENGTH } from '../src/shared/feedback.ts';
import { noMetrics, type Metrics } from './metrics.ts';
import type { Db } from './schema.ts';

export interface FeedbackLimits {
    /** Messages one account may send in `windowMs`. */
    perAccount: number;
    windowMs: number;
    /** The newest messages `/metrics/feedback` lists. */
    listed: number;
}

export const FEEDBACK_LIMITS: FeedbackLimits = {
    perAccount: 10,
    windowMs: 60 * 60 * 1000,
    listed: 200
};

const text = (value: unknown, length: number) =>
    typeof value === 'string' ? value.trim().slice(0, length) : '';

/**
 * `POST /feedback`: a signed-in person sends a message about Reactor, kept with their
 * account, the page they wrote it on and the editor's version.
 */
export function feedbackRoutes(
    db: Db,
    {
        metrics = noMetrics,
        limits = FEEDBACK_LIMITS,
        now = () => new Date()
    }: { metrics?: Metrics; limits?: FeedbackLimits; now?: () => Date } = {}
) {
    const router = express.Router();

    router.post('/feedback', async (req, res) => {
        const message: unknown = req.body?.message;

        if (
            typeof message !== 'string' ||
            message.trim().length === 0 ||
            message.length > FEEDBACK_MAX_LENGTH
        ) {
            return res.status(400).json({ code: 'INVALID_MESSAGE' });
        }

        const since = new Date(now().getTime() - limits.windowMs);
        // One account's messages are counted one at a time, so several sent at once cannot pass the limit together.
        const kept = await db.transaction().execute(async (trx) => {
            await sql`select pg_advisory_xact_lock(hashtextextended(${`feedback:person:${req.userId}`}, 0))`.execute(
                trx
            );

            const { sent } = await trx
                .selectFrom('feedback')
                .select((eb) => eb.fn.countAll<string>().as('sent'))
                .where('user_id', '=', req.userId)
                .where('created_at', '>', since)
                .executeTakeFirstOrThrow();

            if (Number(sent) >= limits.perAccount) {
                return false;
            }

            await trx
                .insertInto('feedback')
                .values({
                    id: randomUUID(),
                    user_id: req.userId,
                    message: message.trim(),
                    page: text(req.body?.page, 200),
                    release: text(req.body?.release, 40),
                    created_at: now()
                })
                .execute();

            return true;
        });

        if (!kept) {
            return res.status(429).json({ code: 'TOO_MUCH_FEEDBACK' });
        }

        metrics.count('reactor_feedback_total', 'Feedback messages people sent from the editor.');

        return res.status(204).end();
    });

    return router;
}

/** The newest feedback first, with who sent it, so it can be answered. */
export const listFeedback = async (db: Db, limits: FeedbackLimits = FEEDBACK_LIMITS) =>
    (
        await sql<{ sentAt: Date; email: string; page: string; release: string; message: string }>`
            select feedback.created_at as "sentAt", person.email, feedback.page,
                feedback.release, feedback.message
            from feedback join auth."user" person on person.id = feedback.user_id
            order by feedback.created_at desc
            limit ${limits.listed}`.execute(db)
    ).rows;
