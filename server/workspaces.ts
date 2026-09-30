import { randomUUID } from 'node:crypto';
import { ROLES, type Db, type Role } from './schema.ts';

/** Whether `role` allows what `needed` does. */
export const allows = (role: Role | undefined, needed: Role) =>
    role !== undefined && ROLES.indexOf(role) >= ROLES.indexOf(needed);

/** Creates the user's personal workspace once, with them as its admin. */
export async function ensurePersonalWorkspace(db: Db, userId: string) {
    await db.transaction().execute(async (trx) => {
        await trx
            .insertInto('workspaces')
            .values({
                id: randomUUID(),
                kind: 'personal',
                name: 'Personal',
                owner_id: userId,
                default_role: 'admin'
            })
            .onConflict((conflict) =>
                conflict.column('owner_id').where('kind', '=', 'personal').doNothing()
            )
            .execute();

        const { id } = await trx
            .selectFrom('workspaces')
            .select('id')
            .where('owner_id', '=', userId)
            .where('kind', '=', 'personal')
            .executeTakeFirstOrThrow();

        await trx
            .insertInto('workspace_members')
            .values({ workspace_id: id, user_id: userId, role: 'admin' })
            .onConflict((conflict) => conflict.columns(['workspace_id', 'user_id']).doNothing())
            .execute();
    });
}

const memberships = (db: Db, userId: string) =>
    db
        .selectFrom('workspace_members as member')
        .innerJoin('workspaces as workspace', 'workspace.id', 'member.workspace_id')
        .where('member.user_id', '=', userId)
        .select((select) => [
            'workspace.id',
            'workspace.kind',
            'workspace.name',
            select.fn.coalesce('member.role', 'workspace.default_role').as('role')
        ]);

/** The workspaces the user belongs to, with their role in each; the personal one first. */
export const listWorkspaces = (db: Db, userId: string) =>
    memberships(db, userId)
        .orderBy((eb) => eb('workspace.kind', '=', 'personal'), 'desc')
        .orderBy('workspace.created_at')
        .execute();

/** The user's role in a workspace, or undefined when they do not belong to it. */
export async function workspaceRole(db: Db, userId: string, workspaceId: string) {
    const found = await memberships(db, userId)
        .where('workspace.id', '=', workspaceId)
        .executeTakeFirst();

    return found?.role;
}

/** The user's role on a document and its workspace, or undefined when they have none. */
export async function documentRole(db: Db, userId: string, documentId: string) {
    const document = await db
        .selectFrom('documents')
        .select('workspace_id')
        .where('id', '=', documentId)
        .executeTakeFirst();

    return document && workspaceRole(db, userId, document.workspace_id);
}

const DOCUMENT = ['id', 'name', 'created_at as createdAt', 'updated_at as updatedAt'] as const;

export const listDocuments = (db: Db, workspaceId: string) =>
    db
        .selectFrom('documents')
        .select(DOCUMENT)
        .where('workspace_id', '=', workspaceId)
        .orderBy('created_at')
        .execute();

export interface DocumentSummary {
    id: string;
    name: string;
    createdAt: Date;
    updatedAt: Date;
}

export type CreatedDocument = { conflict: true } | { document: DocumentSummary; created: boolean };

/**
 * Creates a document with the id the client chose, or a new one. Creating it
 * again in the same workspace, as when a client retries, returns it as it is,
 * and creates it again if it was deleted meanwhile; `conflict` is set when the id
 * is taken elsewhere.
 */
export async function createDocument(
    db: Db,
    {
        id = randomUUID(),
        workspaceId,
        name,
        userId
    }: { id?: string; workspaceId: string; name: string; userId: string }
): Promise<CreatedDocument> {
    const created = await db
        .insertInto('documents')
        .values({ id, workspace_id: workspaceId, name, created_by: userId })
        .onConflict((conflict) => conflict.column('id').doNothing())
        .returning(DOCUMENT)
        .executeTakeFirst();

    if (created) {
        return { document: created, created: true };
    }

    const existing = await db
        .selectFrom('documents')
        .select([...DOCUMENT, 'workspace_id'])
        .where('id', '=', id)
        .executeTakeFirst();

    if (!existing) {
        return createDocument(db, { id, workspaceId, name, userId });
    }

    if (existing.workspace_id !== workspaceId) {
        return { conflict: true };
    }

    return {
        document: {
            id: existing.id,
            name: existing.name,
            createdAt: existing.createdAt,
            updatedAt: existing.updatedAt
        },
        created: false
    };
}

export const deleteDocument = (db: Db, documentId: string) =>
    db.deleteFrom('documents').where('id', '=', documentId).execute();
