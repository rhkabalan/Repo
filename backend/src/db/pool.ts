import pg from 'pg';

// Return BIGINT columns (scores, xp) as JS numbers; values stay well inside 2^53.
pg.types.setTypeParser(pg.types.builtins.INT8, (v) => Number(v));

export type Db = pg.Pool;
export type Queryable = pg.Pool | pg.PoolClient;

export function createPool(connectionString: string, onError: (err: Error) => void = () => undefined): Db {
  const pool = new pg.Pool({ connectionString, max: 20, idleTimeoutMillis: 30_000 });
  // An idle client losing its connection (database restart, failover, network blip) must
  // not crash the server; the pool discards that client and reconnects on next use.
  pool.on('error', onError);
  return pool;
}

/** Run `fn` inside a transaction, committing on success and rolling back on error. */
export async function withTransaction<T>(db: Db, fn: (client: pg.PoolClient) => Promise<T>): Promise<T> {
  const client = await db.connect();
  try {
    await client.query('BEGIN');
    const result = await fn(client);
    await client.query('COMMIT');
    return result;
  } catch (err) {
    await client.query('ROLLBACK').catch(() => undefined);
    throw err;
  } finally {
    client.release();
  }
}
