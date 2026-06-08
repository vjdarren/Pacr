import { Pool } from 'pg';
import { appConfig } from '../config';
import type { RunRecord, GpsSample, CompleteRunBody } from '../types';

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

export const createRun = async (
  userId: string,
  sessionId?: string
): Promise<RunRecord> => {
  const result = await getPool().query<RunRecord>(
    `INSERT INTO run_records (user_id, session_id, started_at, splits)
     VALUES ($1, $2, NOW(), '[]'::jsonb)
     RETURNING *`,
    [userId, sessionId ?? null]
  );
  return result.rows[0];
};

export const appendBatch = async (
  runId: string,
  userId: string,
  samples: GpsSample[]
): Promise<void> => {
  await getPool().query(
    `UPDATE run_records
     SET splits = splits || $1::jsonb
     WHERE id = $2 AND user_id = $3`,
    [JSON.stringify(samples), runId, userId]
  );
};

export const completeRun = async (
  runId: string,
  userId: string,
  body: CompleteRunBody
): Promise<RunRecord | null> => {
  const result = await getPool().query<RunRecord>(
    `UPDATE run_records
     SET ended_at       = NOW(),
         distance_km    = $3,
         duration_sec   = $4,
         avg_pace_sec_km = $5,
         avg_hr_bpm     = $6,
         max_hr_bpm     = $7,
         elevation_gain_m = $8
     WHERE id = $1 AND user_id = $2
     RETURNING *`,
    [
      runId,
      userId,
      body.distanceKm,
      body.durationSec,
      body.avgPaceSecKm,
      body.avgHrBpm ?? null,
      body.maxHrBpm ?? null,
      body.elevationGainM ?? null,
    ]
  );
  return result.rows[0] ?? null;
};

export const getRunById = async (runId: string, userId: string): Promise<RunRecord | null> => {
  const result = await getPool().query<RunRecord>(
    `SELECT * FROM run_records WHERE id = $1 AND user_id = $2`,
    [runId, userId]
  );
  return result.rows[0] ?? null;
};

export const getRecentRuns = async (userId: string, limit = 10): Promise<RunRecord[]> => {
  const result = await getPool().query<RunRecord>(
    `SELECT * FROM run_records
     WHERE user_id = $1
     ORDER BY started_at DESC
     LIMIT $2`,
    [userId, limit]
  );
  return result.rows;
};
