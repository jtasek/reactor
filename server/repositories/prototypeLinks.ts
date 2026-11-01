import type { Db } from '../schema.ts';

export { lockWorkspace } from './members.ts';
export { workspaceRole } from '../workspaces.ts';

export const documentWorkspace = (db: Db, id: string) =>
    db.selectFrom('documents').select('workspace_id').where('id', '=', id).executeTakeFirst();

export const lockDocument = (db: Db, id: string) =>
    db.selectFrom('documents').select('id').where('id', '=', id).forUpdate().executeTakeFirst();

export const listLinks = (db: Db, documentId: string, now: Date) =>
    db
        .selectFrom('prototype_links')
        .select(['id', 'name', 'created_at', 'expires_at'])
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
        size: number;
        expires_at: Date;
    }
) =>
    db
        .insertInto('prototype_links')
        .values(link)
        .returning(['id', 'name', 'created_at', 'expires_at'])
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
        .select('snapshot')
        .where('token_hash', '=', hash)
        .where('expires_at', '>', now)
        .executeTakeFirst();

/** Expired snapshots have no remaining consumers and contain their own image bytes. */
export const deleteExpiredLinks = (db: Db, now: Date) =>
    db.deleteFrom('prototype_links').where('expires_at', '<=', now).execute();
