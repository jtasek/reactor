import { Kysely, PostgresDialect } from 'kysely';
import pg from 'pg';
import type { Database, Log } from './schema.ts';

/**
 * A connection pool to the PostgreSQL database at `connectionString`. A pooled
 * connection that fails while idle, as when the database restarts, is logged and
 * replaced by the next query, instead of ending the process.
 */
export function openPool(connectionString: string, log: Pick<Log, 'error'>) {
    const pool = new pg.Pool({ connectionString });

    pool.on('error', (error) => log.error(error, 'An idle database connection failed'));

    return pool;
}

/** The app's PostgreSQL database; `destroy` closes its connections. */
export const openDatabase = (connectionString: string, log: Log) =>
    new Kysely<Database>({
        dialect: new PostgresDialect({ pool: openPool(connectionString, log) })
    });
