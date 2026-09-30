import { sql } from 'kysely';
import { Migrator } from 'kysely/migration';

const ROLES = sql`('viewer', 'editor', 'admin')`;

/** The app's tables, next to Better Auth's in the `auth` schema; in order, never edited once released. */
const migrations = {
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
    }
};

/** Creates or updates the app's tables. */
export async function migrateApp(db) {
    const migrator = new Migrator({ db, provider: { getMigrations: async () => migrations } });
    const { error } = await migrator.migrateToLatest();

    if (error) {
        throw error;
    }
}
