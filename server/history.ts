import { randomUUID } from 'node:crypto';
import { sql } from 'kysely';
import * as Y from 'yjs';
import { newestVersion } from './restoreContent.ts';
import type { Db, SnapshotReason } from './schema.ts';
import type { DocumentSummary } from './workspaces.ts';

const HOUR = 60 * 60 * 1000;
const DAY = 24 * HOUR;

/** How long after a snapshot the next one is taken, once the document changes again. */
export const SNAPSHOT_INTERVAL_MS = HOUR;

/** How long every snapshot is kept; after that, only each day's last one. */
export const HOURLY_SNAPSHOTS_MS = DAY;

/** How long any snapshot is kept, a deleted document's last one included. */
export const SNAPSHOTS_KEPT_MS = 30 * DAY;

type Writer = Pick<Db, 'insertInto'>;

/** A snapshot as the history lists it, without its content. */
export interface SnapshotSummary {
    id: string;
    createdAt: Date;
    reason: SnapshotReason;
    /** The newest document format that wrote to it. */
    version: number;
    size: number;
}

/** A deleted document that can still be restored. */
export interface DeletedDocument {
    id: string;
    name: string;
    deletedAt: Date;
}

/** Keeps `state` as a snapshot of the document; returns its id. */
export async function insertSnapshot(
    db: Writer,
    snapshot: {
        documentId: string;
        workspaceId: string;
        name: string;
        state: Uint8Array;
        reason: SnapshotReason;
        createdBy?: string | null;
        now: Date;
    }
) {
    const doc = new Y.Doc();
    Y.applyUpdate(doc, snapshot.state);
    const id = randomUUID();

    await db
        .insertInto('document_snapshots')
        .values({
            id,
            document_id: snapshot.documentId,
            workspace_id: snapshot.workspaceId,
            name: snapshot.name,
            state: Buffer.from(snapshot.state),
            size: snapshot.state.byteLength,
            version: newestVersion(doc),
            reason: snapshot.reason,
            created_by: snapshot.createdBy ?? null,
            created_at: snapshot.now
        })
        .execute();

    return id;
}

/**
 * Whether the document is due a snapshot: when it has none, or none in the last
 * `SNAPSHOT_INTERVAL_MS`.
 */
export async function snapshotDue(db: Pick<Db, 'selectFrom'>, documentId: string, now: Date) {
    const latest = await db
        .selectFrom('document_snapshots')
        .select('created_at')
        .where('document_id', '=', documentId)
        .orderBy('created_at', 'desc')
        .limit(1)
        .executeTakeFirst();

    return !latest || now.getTime() - latest.created_at.getTime() >= SNAPSHOT_INTERVAL_MS;
}

/** A document's snapshots, newest first; only those taken in its own workspace. */
export const listSnapshots = (
    db: Db,
    documentId: string,
    workspaceId: string
): Promise<SnapshotSummary[]> =>
    db
        .selectFrom('document_snapshots')
        .select(['id', 'created_at as createdAt', 'reason', 'version', 'size'])
        .where('document_id', '=', documentId)
        .where('workspace_id', '=', workspaceId)
        .orderBy('created_at', 'desc')
        .execute();

/** A snapshot's content, when it is one of the document's in its workspace. */
export const readSnapshot = (db: Db, documentId: string, workspaceId: string, id: string) =>
    db
        .selectFrom('document_snapshots')
        .select(['state', 'version'])
        .where('id', '=', id)
        .where('document_id', '=', documentId)
        .where('workspace_id', '=', workspaceId)
        .executeTakeFirst();

/**
 * Deletes a document, keeping its last content as a snapshot, with the images it
 * used, so an admin can restore it until the snapshot is pruned. Returns false when
 * the document is already gone.
 */
export const deleteDocumentKeepingHistory = (
    db: Db,
    {
        documentId,
        state,
        userId,
        now
    }: { documentId: string; state: Uint8Array; userId: string; now: Date }
) =>
    db.transaction().execute(async (trx) => {
        const document = await trx
            .selectFrom('documents')
            .select(['workspace_id', 'name'])
            .where('id', '=', documentId)
            .forUpdate()
            .executeTakeFirst();

        if (!document) {
            return false;
        }

        const snapshotId = await insertSnapshot(trx, {
            documentId,
            workspaceId: document.workspace_id,
            name: document.name,
            state,
            reason: 'deleted',
            createdBy: userId,
            now
        });

        await trx
            .insertInto('snapshot_assets')
            .columns(['snapshot_id', 'hash'])
            .expression((select) =>
                select
                    .selectFrom('document_assets')
                    .select([sql.lit(snapshotId).as('snapshot_id'), 'hash'])
                    .where('document_id', '=', documentId)
            )
            .execute();
        await trx.deleteFrom('documents').where('id', '=', documentId).execute();

        return true;
    });

/**
 * The workspace's deleted documents that can still be restored, most recently deleted
 * first; not one created again in the workspace with its id.
 */
export async function listDeletedDocuments(
    db: Db,
    workspaceId: string
): Promise<DeletedDocument[]> {
    const rows = await db
        .selectFrom('document_snapshots as snapshot')
        .select(['snapshot.document_id as id', 'snapshot.name', 'snapshot.created_at as deletedAt'])
        .distinctOn('snapshot.document_id')
        .where('snapshot.workspace_id', '=', workspaceId)
        .where('snapshot.reason', '=', 'deleted')
        .where(({ not, exists, selectFrom }) =>
            not(
                exists(
                    selectFrom('documents')
                        .select('id')
                        .whereRef('documents.id', '=', 'snapshot.document_id')
                        .whereRef('documents.workspace_id', '=', 'snapshot.workspace_id')
                )
            )
        )
        .orderBy('snapshot.document_id')
        .orderBy('snapshot.created_at', 'desc')
        .execute();

    return rows.sort((a, b) => b.deletedAt.getTime() - a.deletedAt.getTime());
}

/**
 * A deleted document's content, made the content of the document `id`: the editor
 * reads the shared fields only when they name its own document, and the date it
 * entered Recently Deleted would see it deleted again.
 */
function asRestored(state: Uint8Array, id: string) {
    const doc = new Y.Doc();
    Y.applyUpdate(doc, state);
    const fields = doc.getMap('document');

    doc.transact(() => {
        if (fields.has('id')) fields.set('id', id);
        fields.delete('deleted');
    });

    return Y.encodeStateAsUpdate(doc);
}

/**
 * Restores a deleted document from its last content, as a new document in the
 * same workspace with the images it used and its history. The deleted id is not
 * reused, so copies of the editor that deleted it cannot delete it again. Returns
 * undefined when there is no such deleted document.
 */
export const restoreDeletedDocument = (
    db: Db,
    { workspaceId, documentId, userId }: { workspaceId: string; documentId: string; userId: string }
): Promise<DocumentSummary | undefined> =>
    db.transaction().execute(async (trx) => {
        const deleted = await trx
            .selectFrom('document_snapshots')
            .select(['id', 'name', 'state'])
            .where('document_id', '=', documentId)
            .where('workspace_id', '=', workspaceId)
            .where('reason', '=', 'deleted')
            .orderBy('created_at', 'desc')
            .limit(1)
            .forUpdate()
            .executeTakeFirst();
        // Created again with its id, as a client retrying does, it is no longer deleted.
        const exists = await trx
            .selectFrom('documents')
            .select('id')
            .where('id', '=', documentId)
            .where('workspace_id', '=', workspaceId)
            .executeTakeFirst();

        if (!deleted || exists) {
            return undefined;
        }

        const id = randomUUID();
        const document = await trx
            .insertInto('documents')
            .values({ id, workspace_id: workspaceId, name: deleted.name, created_by: userId })
            .returning(['id', 'name', 'created_at as createdAt', 'updated_at as updatedAt'])
            .executeTakeFirstOrThrow();

        await trx
            .insertInto('document_states')
            .values({ document_id: id, state: Buffer.from(asRestored(deleted.state, id)) })
            .execute();
        await trx
            .insertInto('document_assets')
            .columns(['document_id', 'hash'])
            .expression((select) =>
                select
                    .selectFrom('snapshot_assets')
                    .select([sql.lit(id).as('document_id'), 'hash'])
                    .where('snapshot_id', '=', deleted.id)
            )
            .execute();
        // Its history comes along, and it leaves the deleted documents.
        await trx
            .updateTable('document_snapshots')
            .set({ document_id: id })
            .where('document_id', '=', documentId)
            .where('workspace_id', '=', workspaceId)
            .execute();
        await trx.deleteFrom('snapshot_assets').where('snapshot_id', '=', deleted.id).execute();

        return document;
    });

/**
 * Prunes snapshots to the schedule: every one from the last day, then each
 * document's last one of each day (in UTC), for 30 days. A deleted document's
 * snapshot is kept the whole 30 days.
 */
export async function pruneSnapshots(db: Db, now: Date) {
    const kept = new Date(now.getTime() - SNAPSHOTS_KEPT_MS);
    const hourly = new Date(now.getTime() - HOURLY_SNAPSHOTS_MS);
    const day = (column: string) => sql`date_trunc('day', ${sql.ref(column)} at time zone 'UTC')`;

    await db.deleteFrom('document_snapshots').where('created_at', '<', kept).execute();
    await db
        .deleteFrom('document_snapshots as snapshot')
        .where('snapshot.created_at', '<', hourly)
        .where('snapshot.reason', '<>', 'deleted')
        .where(({ exists, selectFrom }) =>
            exists(
                selectFrom('document_snapshots as later')
                    .select('later.id')
                    .whereRef('later.document_id', '=', 'snapshot.document_id')
                    .whereRef('later.created_at', '>', 'snapshot.created_at')
                    .where(sql<boolean>`${day('later.created_at')} = ${day('snapshot.created_at')}`)
            )
        )
        .execute();
}
