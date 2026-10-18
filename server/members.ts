import express from 'express';
import { sql } from 'kysely';
import type { Db, Role } from './schema.ts';
import { allows, workspaceRole } from './workspaces.ts';

const PATH = '/workspaces/:workspaceId/members';
export type AccessChanged = (workspaceId: string, userId: string) => Promise<void>;

/** Workspace admins manage editor/viewer memberships; admin and owner access stays protected. */
export function createMembers(db: Db, changed: AccessChanged) {
    const router = express.Router();
    router.use(PATH, async (req, res, next) => {
        res.set('Cache-Control', 'no-store');
        const role = await workspaceRole(db, req.userId, req.params.workspaceId);
        if (!allows(role, 'viewer')) return res.status(404).json({ code: 'NOT_FOUND' });
        if (!allows(role, 'admin')) return res.status(403).json({ code: 'FORBIDDEN' });
        next();
    });
    router.get(PATH, async (req, res) => {
        const members = await sql<{
            id: string;
            name: string;
            email: string;
            image: string | null;
            role: Role;
            owner: boolean;
        }>`
            select person.id, person.name, person.email, person.image,
                coalesce(member.role, workspace.default_role) as role,
                coalesce(workspace.owner_id = person.id, false) as owner
            from workspace_members member
            join workspaces workspace on workspace.id = member.workspace_id
            join auth."user" person on person.id = member.user_id
            where member.workspace_id = ${req.params.workspaceId}
            order by (workspace.owner_id = person.id) desc nulls last, person.email
        `.execute(db);
        res.json(members.rows);
    });
    router.all(`${PATH}/:userId`, async (req, res, next) => {
        if (req.method !== 'PATCH' && req.method !== 'DELETE') return next();
        const role: unknown = req.body?.role;
        if (req.method === 'PATCH' && role !== 'viewer' && role !== 'editor')
            return res.status(400).json({ code: 'INVALID_ROLE' });
        const result = await db.transaction().execute(async (trx) => {
            const workspace = await trx
                .selectFrom('workspaces')
                .select(['id', 'owner_id'])
                .where('id', '=', req.params.workspaceId)
                .forUpdate()
                .executeTakeFirst();
            if (!workspace) return 'NOT_FOUND';
            if (!allows(await workspaceRole(trx, req.userId, workspace.id), 'admin'))
                return 'FORBIDDEN';
            const before = await workspaceRole(trx, req.params.userId, workspace.id);
            if (!before) return 'NOT_FOUND';
            if (workspace.owner_id === req.params.userId || before === 'admin')
                return 'PROTECTED_MEMBER';
            if (req.method === 'PATCH') {
                await trx
                    .updateTable('workspace_members')
                    .set({ role: role as 'viewer' | 'editor' })
                    .where('workspace_id', '=', workspace.id)
                    .where('user_id', '=', req.params.userId)
                    .execute();
            } else {
                // The workspace lock also serializes invitation creation and acceptance.
                await sql`delete from workspace_invitations where workspace_id = ${workspace.id}
                    and accepted_at is null and email in
                    (select lower(email) from auth."user" where id = ${req.params.userId})`.execute(
                    trx
                );
                await trx
                    .deleteFrom('workspace_members')
                    .where('workspace_id', '=', workspace.id)
                    .where('user_id', '=', req.params.userId)
                    .execute();
            }
            return undefined;
        });
        if (result) return res.status(result === 'NOT_FOUND' ? 404 : 403).json({ code: result });
        await changed(req.params.workspaceId, req.params.userId);
        res.status(204).end();
    });
    return router;
}
