import { Pool } from 'pg';
import { appConfig } from '../config';

let pool: Pool;

export const initDatabase = (): Pool => {
  pool = new Pool({
    connectionString: appConfig.databaseUrl,
    max: 20,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 2000,
  });

  pool.on('error', (err) => {
    console.error('Unexpected error on idle client', err);
  });

  return pool;
};

export const getPool = (): Pool => {
  if (!pool) return initDatabase();
  return pool;
};

export const closeDatabase = async (): Promise<void> => {
  if (pool) await pool.end();
};
