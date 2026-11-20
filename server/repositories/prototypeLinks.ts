import { sql } from 'kysely';
import type { Db } from '../schema.ts';

export { lockWorkspace } from './members.ts';
export { workspaceRole } from '../workspaces.ts';

export const documentWorkspace = (db: Db, id: string) =>
    db.selectFrom('documents').select('workspace_id').where('id', '=', id).executeTakeFirst();

export const lockDocument = (db: Db, id: string) =>
    db.selectFrom('documents').select('id').where('id', '=', id).forUpdate().executeTakeFirst();

export const documentExists = (db: Db, id: string) =>
    db.selectFrom('documents').select('id').where('id', '=', id).executeTakeFirst();

export const listLinks = (db: Db, documentId: string, now: Date) =>
    db
        .selectFrom('prototype_links')
        .select(['id', 'name', 'version', 'created_at', 'expires_at'])
        .where('document_id', '=', documentId)
        .where('expires_at', '>', now)
        .orderBy('created_at', 'desc')
        .execute();

export const workspaceLinks = (db: Db, workspaceId: string) =>
    db
        .selectFrom('prototype_links')
        .select(['document_id', 'size'])
        .where('workspace_id', '=', workspaceId)
        .execute();

export const removeExpired = (db: Db, workspaceId: string, now: Date) =>
    db
        .deleteFrom('prototype_links')
        .where('workspace_id', '=', workspaceId)
        .where('expires_at', '<=', now)
        .execute();

export const insertLink = (
    db: Db,
    link: {
        id: string;
        workspace_id: string;
        document_id: string;
        name: string;
        token_hash: string;
        snapshot: string;
        version: number;
        size: number;
        expires_at: Date;
    }
) =>
    db
        .insertInto('prototype_links')
        .values(link)
        .returning(['id', 'name', 'version', 'created_at', 'expires_at'])
        .executeTakeFirstOrThrow();

export const deleteLink = (db: Db, documentId: string, id: string) =>
    db
        .deleteFrom('prototype_links')
        .where('document_id', '=', documentId)
        .where('id', '=', id)
        .returning('id')
        .executeTakeFirst();

export const snapshotForToken = (db: Db, hash: string, now: Date) =>
    db
        .selectFrom('prototype_links')
        .select(['id', 'snapshot', 'version'])
        .where('token_hash', '=', hash)
        .where('expires_at', '>', now)
        .executeTakeFirst();

/** Expired snapshots have no remaining consumers and contain their own image bytes. */
export const deleteExpiredLinks = (db: Db, now: Date) =>
    db.deleteFrom('prototype_links').where('expires_at', '<=', now).execute();

export const recordShare = (
    db: Db,
    share: {
        link_id: string;
        workspace_id: string;
        document_id: string;
        created_by: string;
        screens: number;
        started_at: Date | null;
    }
) => db.insertInto('shared_prototypes').values(share).execute();

/** How many links `userId` has shared, and when their account was created. */
export async function sharer(db: Db, userId: string) {
    const result = await sql<{ shares: number; accountCreatedAt: Date }>`
        select person."createdAt" as "accountCreatedAt",
            (select count(*)::integer from shared_prototypes where created_by = person.id) as shares
        from auth."user" person
        where person.id = ${userId}
    `.execute(db);

    return result.rows[0];
}

/**
 * Each person's first shared link: when they started, the earlier of their account's
 * creation and the shared document's, and when they shared it.
 */
export async function firstSharedLinks(db: Db) {
    const result = await sql<{
        createdBy: string;
        linkId: string;
        screens: number;
        accountCreatedAt: Date;
        startedAt: Date;
        sharedAt: Date;
        seconds: number;
    }>`
        select distinct on (shared.created_by)
            shared.created_by as "createdBy",
            shared.link_id as "linkId",
            shared.screens,
            person."createdAt" as "accountCreatedAt",
            least(person."createdAt", shared.started_at) as "startedAt",
            shared.created_at as "sharedAt",
            extract(epoch from shared.created_at
                - least(person."createdAt", shared.started_at))::float8 as seconds
        from shared_prototypes shared
        join auth."user" person on person.id = shared.created_by
        order by shared.created_by, shared.created_at
    `.execute(db);

    return result.rows.sort(
        (first, second) => second.sharedAt.getTime() - first.sharedAt.getTime()
    );
}

/**
 * Counts an open by `player`; a new player only while the link has fewer than `limit`.
 * Says whether the player is counted.
 */
export async function recordPlayer(
    db: Db,
    linkId: string,
    player: string,
    limit: number,
    now: Date
) {
    const opened = await db
        .updateTable('prototype_players')
        .set((eb) => ({ opens: eb('opens', '+', 1), last_opened_at: now }))
        .where('link_id', '=', linkId)
        .where('player', '=', player)
        .returning('player')
        .executeTakeFirst();
    if (opened) {
        return true;
    }
    const { count } = await db
        .selectFrom('prototype_players')
        .select((eb) => eb.fn.countAll<number>().as('count'))
        .where('link_id', '=', linkId)
        .executeTakeFirstOrThrow();
    if (Number(count) >= limit) {
        return false;
    }
    await db
        .insertInto('prototype_players')
        .values({ link_id: linkId, player, first_opened_at: now, last_opened_at: now })
        .onConflict((conflict) =>
            conflict.columns(['link_id', 'player']).doUpdateSet((eb) => ({
                opens: eb('prototype_players.opens', '+', 1),
                last_opened_at: now
            }))
        )
        .execute();

    return true;
}

/** Continues `player`'s last session of the link if it was opened after `since`, else starts one. */
export async function recordSession(
    db: Db,
    session: { linkId: string; player: string; byAuthor: boolean },
    since: Date,
    now: Date
) {
    const continued = await db
        .updateTable('prototype_sessions')
        .set({ last_opened_at: now })
        .where('link_id', '=', session.linkId)
        .where('player', '=', session.player)
        .where('last_opened_at', '>', since)
        .returning('started_at')
        .executeTakeFirst();
    if (continued) {
        return false;
    }
    await db
        .insertInto('prototype_sessions')
        .values({
            link_id: session.linkId,
            player: session.player,
            started_at: now,
            last_opened_at: now,
            by_author: session.byAuthor
        })
        .onConflict((conflict) => conflict.doNothing())
        .execute();

    return true;
}

/**
 * R7's measures for each of the last `weeks` weeks, newest first, weeks starting on Monday
 * in UTC: people who signed up, how many of them shared a prototype with at least two
 * screens within `activationMs` of signing up, and prototype sessions run by others than
 * the link's author. A week's sign-ups are final once `activationMs` has passed after it.
 */
export async function betaMeasures(
    db: Db,
    { now, weeks, activationMs }: { now: Date; weeks: number; activationMs: number }
) {
    const result = await sql<{
        week: Date;
        signUps: number;
        activated: number;
        signUpsFinal: boolean;
        sessionsByOthers: number;
        sessionsByAuthors: number;
        linksPlayedByOthers: number;
    }>`
        with weeks as (
            select generate_series(
                date_trunc('week', ${now}::timestamptz, 'UTC') - ${weeks - 1} * interval '1 week',
                date_trunc('week', ${now}::timestamptz, 'UTC'),
                interval '1 week'
            ) as week
        ),
        window_ as (select make_interval(secs => ${activationMs / 1000}) as activation)
        select weeks.week,
            (select count(*)::integer from auth."user" person
                where person."createdAt" >= weeks.week
                    and person."createdAt" < weeks.week + interval '1 week') as "signUps",
            (select count(*)::integer from auth."user" person
                where person."createdAt" >= weeks.week
                    and person."createdAt" < weeks.week + interval '1 week'
                    and exists (
                        select 1 from shared_prototypes shared
                        where shared.created_by = person.id
                            and shared.screens >= 2
                            and shared.created_at <= person."createdAt" + window_.activation
                    )) as activated,
            weeks.week + interval '1 week' + window_.activation <= ${now}::timestamptz
                as "signUpsFinal",
            (select count(*)::integer from prototype_sessions session
                where session.started_at >= weeks.week
                    and session.started_at < weeks.week + interval '1 week'
                    and not session.by_author) as "sessionsByOthers",
            (select count(*)::integer from prototype_sessions session
                where session.started_at >= weeks.week
                    and session.started_at < weeks.week + interval '1 week'
                    and session.by_author) as "sessionsByAuthors",
            (select count(distinct session.link_id)::integer from prototype_sessions session
                where session.started_at >= weeks.week
                    and session.started_at < weeks.week + interval '1 week'
                    and not session.by_author) as "linksPlayedByOthers"
        from weeks, window_
        order by weeks.week desc
    `.execute(db);

    return result.rows;
}

/** Every shared prototype, newest first, with its distinct players and their opens. */
export const sharedPrototypes = (db: Db) =>
    db
        .selectFrom('shared_prototypes as shared')
        .leftJoin('prototype_players as players', 'players.link_id', 'shared.link_id')
        .leftJoin('prototype_links as links', 'links.id', 'shared.link_id')
        .select((eb) => [
            'shared.link_id as linkId',
            'shared.workspace_id as workspaceId',
            'shared.document_id as documentId',
            'shared.created_by as createdBy',
            'shared.screens',
            'shared.created_at as createdAt',
            'links.expires_at as expiresAt',
            // PostgreSQL counts and sums in bigint, which node-postgres reads as text.
            eb.cast<number>(eb.fn.count('players.player'), 'integer').as('players'),
            eb
                .cast<number>(eb.fn.coalesce(eb.fn.sum('players.opens'), eb.lit(0)), 'integer')
                .as('opens'),
            eb.fn.max('players.last_opened_at').as('lastOpenedAt')
        ])
        .groupBy(['shared.link_id', 'links.expires_at'])
        .orderBy('shared.created_at', 'desc')
        .execute();
