import type { Db, Log } from '../schema.ts';
import { allows } from '../workspaces.ts';
import {
    deleteMember,
    listMembers,
    lockWorkspace,
    setMemberRole,
    revokeMemberInvitations,
    workspaceRole,
    type WorkspaceMember
} from '../repositories/members.ts';

export type AccessChanged = (workspaceId: string, userId: string) => Promise<void>;
export type MemberProblem = 'NOT_FOUND' | 'FORBIDDEN' | 'PROTECTED_MEMBER' | 'INVALID_ROLE';
type MemberFailure = { ok: false; problem: MemberProblem };
export type MemberResult = { ok: true } | MemberFailure;
type MemberListResult = { ok: true; members: WorkspaceMember[] } | MemberFailure;

interface WorkspaceAccess {
    actorId: string;
    workspaceId: string;
}

interface MemberChange extends WorkspaceAccess {
    userId: string;
}

type Change = { kind: 'set-role'; role: unknown } | { kind: 'remove' };

/** Membership policy and transactions, independent of HTTP. */
export function createMemberService(db: Db, changed: AccessChanged, log: Pick<Log, 'warn'>) {
    async function access(
        database: Db,
        { actorId, workspaceId }: WorkspaceAccess
    ): Promise<MemberResult> {
        const role = await workspaceRole(database, actorId, workspaceId);

        if (!allows(role, 'viewer')) {
            return { ok: false, problem: 'NOT_FOUND' };
        }

        if (!allows(role, 'admin')) {
            return { ok: false, problem: 'FORBIDDEN' };
        }

        return { ok: true };
    }

    async function notify(workspaceId: string, userId: string) {
        try {
            await changed(workspaceId, userId);

            return;
        } catch (error) {
            log.warn(error, 'Membership committed; retrying connection cleanup');
        }

        try {
            await changed(workspaceId, userId);
        } catch (retryError) {
            // Incoming messages and idle checks enforce access if cleanup remains unavailable.
            log.warn(
                retryError,
                'Connection cleanup failed after retry; permission checks remain active'
            );
        }
    }

    async function change(input: MemberChange, operation: Change): Promise<MemberResult> {
        const { workspaceId, userId } = input;
        const result = await db.transaction().execute(async (trx): Promise<MemberResult> => {
            const workspace = await lockWorkspace(trx, workspaceId);

            if (!workspace) {
                return { ok: false, problem: 'NOT_FOUND' };
            }

            const permission = await access(trx, input);

            if (!permission.ok) {
                return permission;
            }

            if (
                operation.kind === 'set-role' &&
                operation.role !== 'viewer' &&
                operation.role !== 'editor'
            ) {
                return { ok: false, problem: 'INVALID_ROLE' };
            }

            const before = await workspaceRole(trx, userId, workspaceId);

            if (!before) {
                return { ok: false, problem: 'NOT_FOUND' };
            }

            if (workspace.owner_id === userId || before === 'admin') {
                return { ok: false, problem: 'PROTECTED_MEMBER' };
            }

            if (operation.kind === 'set-role') {
                await setMemberRole(
                    trx,
                    workspaceId,
                    userId,
                    operation.role as 'viewer' | 'editor'
                );

                return { ok: true };
            }

            await revokeMemberInvitations(trx, workspaceId, userId);
            await deleteMember(trx, workspaceId, userId);

            return { ok: true };
        });

        if (!result.ok) {
            return result;
        }

        await notify(workspaceId, userId);

        return result;
    }

    return {
        async list(input: WorkspaceAccess): Promise<MemberListResult> {
            const permission = await access(db, input);

            if (!permission.ok) {
                return permission;
            }

            return { ok: true, members: await listMembers(db, input.workspaceId) };
        },
        setRole: (input: MemberChange, role: unknown) => change(input, { kind: 'set-role', role }),
        remove: (input: MemberChange) => change(input, { kind: 'remove' })
    };
}
