import { Kysely, PostgresDialect } from 'kysely';
import pg from 'pg';

/** The app's PostgreSQL database at `connectionString`; `destroy` closes its connections. */
export const openDatabase = (connectionString) =>
    new Kysely({ dialect: new PostgresDialect({ pool: new pg.Pool({ connectionString }) }) });
