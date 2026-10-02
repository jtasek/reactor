import type { Generated, Kysely } from 'kysely';

/** Roles on a workspace or document, weakest first. */
export const ROLES = ['viewer', 'editor', 'admin'] as const;

export type Role = (typeof ROLES)[number];

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
    };
    document_assets: {
        document_id: string;
        hash: string;
    };
}

export type Db = Kysely<Database>;

/** Where the server logs, as `console` or a pino logger. */
export type Log = Pick<Console, 'info' | 'warn' | 'error'>;
