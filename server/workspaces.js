import { randomUUID } from 'node:crypto';

/** Roles on a workspace or document, weakest first. */
export const ROLES = ['viewer', 'editor', 'admin'];

/** Whether `role` allows what `needed` does. */
export const allows = (role, needed) =>
    role !== undefined && ROLES.indexOf(role) >= ROLES.indexOf(needed);

/** Creates the user's personal workspace once, with them as its admin. */
export async function ensurePersonalWorkspace(db, userId) {
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

const memberships = (db, userId) =>
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
export const workspacesOf = (db, userId) =>
    memberships(db, userId)
        .orderBy((eb) => eb('workspace.kind', '=', 'personal'), 'desc')
        .orderBy('workspace.created_at')
        .execute();

/** The user's role in a workspace, or undefined when they do not belong to it. */
export async function roleIn(db, userId, workspaceId) {
    const found = await memberships(db, userId)
        .where('workspace.id', '=', workspaceId)
        .executeTakeFirst();

    return found?.role;
}

/** The user's role on a document and its workspace, or undefined when they have none. */
export async function roleOnDocument(db, userId, documentId) {
    const document = await db
        .selectFrom('documents')
        .select('workspace_id')
        .where('id', '=', documentId)
        .executeTakeFirst();

    return document && roleIn(db, userId, document.workspace_id);
}

const DOCUMENT = ['id', 'name', 'created_at as createdAt', 'updated_at as updatedAt'];

export const documentsIn = (db, workspaceId) =>
    db
        .selectFrom('documents')
        .select(DOCUMENT)
        .where('workspace_id', '=', workspaceId)
        .orderBy('created_at')
        .execute();

export const createDocument = (db, { workspaceId, name, userId }) =>
    db
        .insertInto('documents')
        .values({ id: randomUUID(), workspace_id: workspaceId, name, created_by: userId })
        .returning(DOCUMENT)
        .executeTakeFirstOrThrow();

export const deleteDocument = (db, documentId) =>
    db.deleteFrom('documents').where('id', '=', documentId).execute();
