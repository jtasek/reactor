import { sql } from 'kysely';
import type { Db, Role } from '../schema.ts';

export { workspaceRole } from '../workspaces.ts';

export interface WorkspaceMember {
    id: string;
    name: string;
    email: string;
    image: string | null;
    role: Role;
    owner: boolean;
}

export async function listMembers(db: Db, workspaceId: string) {
    const result = await sql<WorkspaceMember>`
        select person.id, person.name, person.email, person.image,
            coalesce(member.role, workspace.default_role) as role,
            coalesce(workspace.owner_id = person.id, false) as owner
        from workspace_members member
        join workspaces workspace on workspace.id = member.workspace_id
        join auth."user" person on person.id = member.user_id
        where member.workspace_id = ${workspaceId}
        order by (workspace.owner_id = person.id) desc nulls last, person.email
    `.execute(db);

    return result.rows;
}

/** Serializes membership changes with invitation creation and acceptance. */
export function lockWorkspace(db: Db, workspaceId: string) {
    return db
        .selectFrom('workspaces')
        .select(['id', 'owner_id'])
        .where('id', '=', workspaceId)
        .forUpdate()
        .executeTakeFirst();
}

export function setMemberRole(
    db: Db,
    workspaceId: string,
    userId: string,
    role: 'viewer' | 'editor'
) {
    return db
        .updateTable('workspace_members')
        .set({ role })
        .where('workspace_id', '=', workspaceId)
        .where('user_id', '=', userId)
        .execute();
}

export function revokeMemberInvitations(db: Db, workspaceId: string, userId: string) {
    return sql`delete from workspace_invitations where workspace_id = ${workspaceId}
        and accepted_at is null and email in
        (select lower(email) from auth."user" where id = ${userId})`.execute(db);
}

export function deleteMember(db: Db, workspaceId: string, userId: string) {
    return db
        .deleteFrom('workspace_members')
        .where('workspace_id', '=', workspaceId)
        .where('user_id', '=', userId)
        .execute();
}
