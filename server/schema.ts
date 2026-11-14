import type { Generated, Kysely } from 'kysely';

/** Roles on a workspace or document, weakest first. */
export const ROLES = ['viewer', 'editor', 'admin'] as const;

export type Role = (typeof ROLES)[number];

/**
 * Why a snapshot was taken: on the hourly schedule, just before a Restore replaced
 * the content, or as the document was deleted.
 */
export type SnapshotReason = 'scheduled' | 'before-restore' | 'deleted';

/** The app's tables, as `migrations.ts` creates them. */
export interface Database {
    workspaces: {
        id: string;
        kind: 'personal' | 'team' | 'organization';
        name: string;
        owner_id: string | null;
        default_role: Role;
        created_at: Generated<Date>;
    };
    workspace_members: {
        workspace_id: string;
        user_id: string;
        role: Role | null;
    };
    workspace_invitations: {
        id: string;
        workspace_id: string;
        email: string;
        role: 'viewer' | 'editor';
        token_hash: string;
        created_by: string;
        expires_at: Date;
        created_at: Generated<Date>;
        accepted_at: Date | null;
        accepted_by: string | null;
    };
    documents: {
        id: string;
        workspace_id: string;
        name: string;
        created_by: string | null;
        created_at: Generated<Date>;
        updated_at: Generated<Date>;
    };
    document_states: {
        document_id: string;
        state: Buffer;
        updated_at: Generated<Date>;
    };
    assets: {
        hash: string;
        type: string;
        size: number;
        created_at: Generated<Date>;
    };
    asset_blobs: {
        hash: string;
        bytes: Buffer;
        created_at: Generated<Date>;
    };
    document_assets: {
        document_id: string;
        hash: string;
    };
    prototype_links: {
        id: string;
        workspace_id: string;
        document_id: string;
        name: string;
        token_hash: string;
        snapshot: string;
        /** The preview protocol the snapshot was written for. */
        version: number;
        size: number;
        created_at: Generated<Date>;
        expires_at: Date;
    };
    document_snapshots: {
        id: string;
        /** The document's id, which may no longer exist once it is deleted. */
        document_id: string;
        workspace_id: string;
        /** The document's name when the snapshot was taken. */
        name: string;
        /** The document's whole content, as one Yjs update. */
        state: Buffer;
        size: number;
        /** The newest document format that wrote to it. */
        version: number;
        reason: SnapshotReason;
        created_by: string | null;
        created_at: Generated<Date>;
    };
    snapshot_assets: {
        snapshot_id: string;
        hash: string;
    };
    ai_requests: {
        id: string;
        workspace_id: string;
        user_id: string;
        document_id: string | null;
        task: string;
        model: string;
        input_tokens: Generated<number>;
        output_tokens: Generated<number>;
        created_at: Generated<Date>;
    };
}

export type Db = Kysely<Database>;

/** Where the server logs, as `console` or a pino logger. */
export type Log = Pick<Console, 'info' | 'warn' | 'error'>;
