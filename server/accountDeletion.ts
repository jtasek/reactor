import type { Db } from './schema.ts';

/** What closing a deleted account's live connections needs of the document sync. */
export interface AccountConnections {
    closeDocument(documentId: string): void;
    closeMember(workspaceId: string, userId: string): Promise<void>;
}

/**
 * Deleting an account deletes the workspaces it owns, with their documents,
 * history and shared links, and its memberships of others' workspaces, through the
 * tables' cascades. Read before the account goes, `closeConnections` then
 * disconnects everyone from the deleted documents and the person from the rest.
 */
export async function accountReach(db: Db, userId: string) {
    const owned = await db
        .selectFrom('documents')
        .innerJoin('workspaces', 'workspaces.id', 'documents.workspace_id')
        .select('documents.id')
        .where('workspaces.owner_id', '=', userId)
        .execute();
    const memberships = await db
        .selectFrom('workspace_members')
        .innerJoin('workspaces', 'workspaces.id', 'workspace_members.workspace_id')
        .select('workspaces.id')
        .where('workspace_members.user_id', '=', userId)
        .where((eb) =>
            eb.or([eb('workspaces.owner_id', 'is', null), eb('workspaces.owner_id', '!=', userId)])
        )
        .execute();

    return async (connections: AccountConnections) => {
        for (const { id } of owned) {
            connections.closeDocument(id);
        }

        await Promise.all(memberships.map(({ id }) => connections.closeMember(id, userId)));
    };
}
