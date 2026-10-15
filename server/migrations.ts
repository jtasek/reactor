import { sql } from 'kysely';
import { Migrator, type Migration } from 'kysely/migration';
import type { Db } from './schema.ts';

const ROLES = sql`('viewer', 'editor', 'admin')`;

/** The app's tables, next to Better Auth's in the `auth` schema; in order, never edited once released. */
const migrations: Record<string, Migration> = {
    '0001_workspaces': {
        async up(db) {
            await db.schema
                .createTable('workspaces')
                .addColumn('id', 'text', (column) => column.primaryKey())
                .addColumn('kind', 'text', (column) =>
                    column.notNull().check(sql`kind in ('personal', 'team', 'organization')`)
                )
                .addColumn('name', 'text', (column) => column.notNull())
                .addColumn('owner_id', 'text', (column) =>
                    column.references('auth.user.id').onDelete('cascade')
                )
                .addColumn('default_role', 'text', (column) =>
                    column.notNull().check(sql`default_role in ${ROLES}`)
                )
                .addColumn('created_at', 'timestamptz', (column) =>
                    column.notNull().defaultTo(sql`now()`)
                )
                .execute();
            await db.schema
                .createIndex('workspaces_personal_owner')
                .on('workspaces')
                .column('owner_id')
                .unique()
                .where(sql.ref('kind'), '=', 'personal')
                .execute();
            await db.schema
                .createTable('workspace_members')
                .addColumn('workspace_id', 'text', (column) =>
                    column.notNull().references('workspaces.id').onDelete('cascade')
                )
                .addColumn('user_id', 'text', (column) =>
                    column.notNull().references('auth.user.id').onDelete('cascade')
                )
                // Without one, the member has the workspace's default role.
                .addColumn('role', 'text', (column) => column.check(sql`role in ${ROLES}`))
                .addPrimaryKeyConstraint('workspace_members_pkey', ['workspace_id', 'user_id'])
                .execute();
            await db.schema
                .createIndex('workspace_members_user')
                .on('workspace_members')
                .column('user_id')
                .execute();
            await db.schema
                .createTable('documents')
                .addColumn('id', 'text', (column) => column.primaryKey())
                .addColumn('workspace_id', 'text', (column) =>
                    column.notNull().references('workspaces.id').onDelete('cascade')
                )
                .addColumn('name', 'text', (column) => column.notNull())
                .addColumn('created_by', 'text', (column) =>
                    column.references('auth.user.id').onDelete('set null')
                )
                .addColumn('created_at', 'timestamptz', (column) =>
                    column.notNull().defaultTo(sql`now()`)
                )
                .addColumn('updated_at', 'timestamptz', (column) =>
                    column.notNull().defaultTo(sql`now()`)
                )
                .execute();
            await db.schema
                .createIndex('documents_workspace')
                .on('documents')
                .column('workspace_id')
                .execute();
        }
    },
    '0002_document_states': {
        async up(db) {
            // Each document's shared content, as one Yjs update holding all of it.
            await db.schema
                .createTable('document_states')
                .addColumn('document_id', 'text', (column) =>
                    column.primaryKey().references('documents.id').onDelete('cascade')
                )
                .addColumn('state', 'bytea', (column) => column.notNull())
                .addColumn('updated_at', 'timestamptz', (column) =>
                    column.notNull().defaultTo(sql`now()`)
                )
                .execute();
        }
    },
    '0003_assets': {
        async up(db) {
            // An image, named by the SHA-256 of its bytes, which are kept apart.
            await db.schema
                .createTable('assets')
                .addColumn('hash', 'text', (column) => column.primaryKey())
                .addColumn('type', 'text', (column) => column.notNull())
                .addColumn('size', 'integer', (column) => column.notNull())
                .addColumn('created_at', 'timestamptz', (column) =>
                    column.notNull().defaultTo(sql`now()`)
                )
                .execute();
            await db.schema
                .createTable('asset_blobs')
                .addColumn('hash', 'text', (column) => column.primaryKey())
                .addColumn('bytes', 'bytea', (column) => column.notNull())
                .execute();
            // The documents using an image: it is read and counted through them.
            await db.schema
                .createTable('document_assets')
                .addColumn('document_id', 'text', (column) =>
                    column.notNull().references('documents.id').onDelete('cascade')
                )
                .addColumn('hash', 'text', (column) => column.notNull().references('assets.hash'))
                .addPrimaryKeyConstraint('document_assets_pkey', ['document_id', 'hash'])
                .execute();
            await db.schema
                .createIndex('document_assets_hash')
                .on('document_assets')
                .column('hash')
                .execute();
        }
    },
    '0004_asset_blob_times': {
        async up(db) {
            // When bytes were last stored, so a cleanup spares those an upload is linking.
            await db.schema
                .alterTable('asset_blobs')
                .addColumn('created_at', 'timestamptz', (column) =>
                    column.notNull().defaultTo(sql`now()`)
                )
                .execute();
        }
    },
    '0005_ai_requests': {
        async up(db) {
            // One row per AI request and the tokens it used, counted against each day's limits.
            await db.schema
                .createTable('ai_requests')
                .addColumn('id', 'text', (column) => column.primaryKey())
                .addColumn('workspace_id', 'text', (column) =>
                    column.notNull().references('workspaces.id').onDelete('cascade')
                )
                .addColumn('user_id', 'text', (column) =>
                    column.notNull().references('auth.user.id').onDelete('cascade')
                )
                // Kept when the document is deleted, as its requests still count.
                .addColumn('document_id', 'text', (column) =>
                    column.references('documents.id').onDelete('set null')
                )
                .addColumn('task', 'text', (column) => column.notNull())
                .addColumn('model', 'text', (column) => column.notNull())
                .addColumn('input_tokens', 'integer', (column) => column.notNull().defaultTo(0))
                .addColumn('output_tokens', 'integer', (column) => column.notNull().defaultTo(0))
                .addColumn('created_at', 'timestamptz', (column) =>
                    column.notNull().defaultTo(sql`now()`)
                )
                .execute();
            await db.schema
                .createIndex('ai_requests_workspace_time')
                .on('ai_requests')
                .columns(['workspace_id', 'created_at'])
                .execute();
            await db.schema
                .createIndex('ai_requests_user_time')
                .on('ai_requests')
                .columns(['user_id', 'created_at'])
                .execute();
        }
    }
};

/** Creates or updates the app's tables. */
export async function migrateApp(db: Db) {
    const migrator = new Migrator({ db, provider: { getMigrations: async () => migrations } });
    const { error } = await migrator.migrateToLatest();

    if (error) {
        throw error;
    }
}
