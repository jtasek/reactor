import express, { type Request, type Response } from 'express';
import { createHash, randomBytes, randomUUID } from 'node:crypto';
import type { Db } from './schema.ts';
import { allows, workspaceRole } from './workspaces.ts';

const INVITATION_LIFETIME = 7 * 24 * 60 * 60 * 1000;
const TOKEN_BYTES = 32;
const MAX_EMAIL_LENGTH = 254;
const WORKSPACE = '/workspaces/:workspaceId/invitations';
const SUMMARY = [
    'id',
    'email',
    'role',
    'expires_at as expiresAt',
    'created_at as createdAt'
] as const;
const hash = (token: string) => createHash('sha256').update(token).digest('hex');
const refuse = (res: Response, status: number, code: string) => res.status(status).json({ code });

/** Invitation capabilities are kept in request bodies, never URL paths or query strings. */
function tokenOf(req: Request) {
    const token: unknown = req.body?.token;
    return typeof token === 'string' && /^[a-f0-9]{64}$/.test(token) ? token : undefined;
}

/** Session and Origin checks are supplied by the parent API router. */
export function createInvitations(db: Db) {
    const router = express.Router();
    router.use(['/invitations', '/workspaces/:workspaceId/invitations'], (_req, res, next) => {
        res.set('Cache-Control', 'no-store');
        next();
    });
    router.use(WORKSPACE, async (req, res, next) => {
        const role = await workspaceRole(db, req.userId, req.params.workspaceId);
        if (!allows(role, 'viewer')) return refuse(res, 404, 'NOT_FOUND');
        if (!allows(role, 'admin')) return refuse(res, 403, 'FORBIDDEN');
        next();
    });

    router.post(WORKSPACE, async (req, res) => {
        const email =
            typeof req.body?.email === 'string' ? req.body.email.trim().toLowerCase() : '';
        const role: unknown = req.body?.role;
        if (email.length > MAX_EMAIL_LENGTH || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))
            return refuse(res, 400, 'INVALID_EMAIL');
        if (role !== 'viewer' && role !== 'editor') return refuse(res, 400, 'INVALID_ROLE');
        const token = randomBytes(TOKEN_BYTES).toString('hex');
        const invitation = await db.transaction().execute(async (trx) => {
            // Serialize creation/renewal in this workspace; a new invite replaces pending links.
            await trx
                .selectFrom('workspaces')
                .select('id')
                .where('id', '=', req.params.workspaceId)
                .forUpdate()
                .executeTakeFirstOrThrow();
            await trx
                .deleteFrom('workspace_invitations')
                .where('workspace_id', '=', req.params.workspaceId)
                .where('email', '=', email)
                .where('accepted_at', 'is', null)
                .execute();
            return trx
                .insertInto('workspace_invitations')
                .values({
                    id: randomUUID(),
                    workspace_id: req.params.workspaceId,
                    email,
                    role,
                    token_hash: hash(token),
                    created_by: req.userId,
                    expires_at: new Date(Date.now() + INVITATION_LIFETIME),
                    accepted_at: null,
                    accepted_by: null
                })
                .returning(SUMMARY)
                .executeTakeFirstOrThrow();
        });
        res.status(201).json({ ...invitation, token });
    });
    router.get(WORKSPACE, async (req, res) => {
        res.json(
            await db
                .selectFrom('workspace_invitations')
                .select(SUMMARY)
                .where('workspace_id', '=', req.params.workspaceId)
                .where('accepted_at', 'is', null)
                .where('expires_at', '>', new Date())
                .orderBy('created_at')
                .execute()
        );
    });
    router.delete(`${WORKSPACE}/:invitationId`, async (req, res) => {
        await db
            .deleteFrom('workspace_invitations')
            .where('workspace_id', '=', req.params.workspaceId)
            .where('id', '=', req.params.invitationId)
            .where('accepted_at', 'is', null)
            .execute();
        res.status(204).end();
    });

    /** Consumed invitations belong to the accepting account only while it remains a member. */
    async function pending(trx: Db, req: Request, token: string, lock: boolean) {
        let query = trx
            .selectFrom('workspace_invitations')
            .selectAll()
            .where('token_hash', '=', hash(token))
            .where('email', '=', req.userEmail)
            .where('expires_at', '>', new Date());
        if (lock) query = query.forUpdate();
        const invitation = await query.executeTakeFirst();
        if (
            !invitation ||
            !allows(
                await workspaceRole(trx, invitation.created_by, invitation.workspace_id),
                'admin'
            )
        )
            return;
        if (
            invitation.accepted_at !== null &&
            (invitation.accepted_by !== req.userId ||
                !(await workspaceRole(trx, req.userId, invitation.workspace_id)))
        )
            return;
        return invitation;
    }
    router.post('/invitations/inspect', async (req, res) => {
        if (!req.emailVerified) return refuse(res, 403, 'EMAIL_NOT_VERIFIED');
        const token = tokenOf(req);
        const invitation = token && (await pending(db, req, token, false));
        if (!invitation) return refuse(res, 404, 'NOT_FOUND');
        const workspace = await db
            .selectFrom('workspaces')
            .select('name')
            .where('id', '=', invitation.workspace_id)
            .executeTakeFirst();
        if (!workspace) return refuse(res, 404, 'NOT_FOUND');
        res.json({
            workspaceName: workspace.name,
            email: invitation.email,
            role: invitation.role,
            expiresAt: invitation.expires_at,
            accepted: invitation.accepted_at !== null
        });
    });
    router.post('/invitations/accept', async (req, res) => {
        if (!req.emailVerified) return refuse(res, 403, 'EMAIL_NOT_VERIFIED');
        const token = tokenOf(req);
        if (!token) return refuse(res, 404, 'NOT_FOUND');
        const result = await db.transaction().execute(async (trx) => {
            const invitation = await pending(trx, req, token, true);
            if (!invitation) return;
            const before = await workspaceRole(trx, req.userId, invitation.workspace_id);
            if (invitation.accepted_at === null) {
                await trx
                    .insertInto('workspace_members')
                    .values({
                        workspace_id: invitation.workspace_id,
                        user_id: req.userId,
                        role: invitation.role
                    })
                    .onConflict((c) => c.columns(['workspace_id', 'user_id']).doNothing())
                    .execute();
                await trx
                    .updateTable('workspace_invitations')
                    .set({ accepted_at: new Date(), accepted_by: req.userId })
                    .where('id', '=', invitation.id)
                    .execute();
            }
            return {
                workspaceId: invitation.workspace_id,
                role: await workspaceRole(trx, req.userId, invitation.workspace_id),
                alreadyMember: before !== undefined
            };
        });
        if (!result) return refuse(res, 404, 'NOT_FOUND');
        res.json(result);
    });
    return router;
}
