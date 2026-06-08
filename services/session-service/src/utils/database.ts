import { Pool } from 'pg';
import { appConfig } from '../config';
import type { TrainingSessionRow } from '../types';

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

export const getTodaySession = async (userId: string): Promise<TrainingSessionRow | null> => {
  const result = await getPool().query<TrainingSessionRow>(
    `SELECT ts.id, ts.plan_id, ts.scheduled_date, ts.session_type,
            ts.target_distance_km, ts.target_duration_min, ts.target_pace_zone,
            ts.target_hr_zone, ts.rpe_target, ts.structure, ts.status,
            ts.completed_run_id, ts.created_at
     FROM training_sessions ts
     JOIN training_plans tp ON ts.plan_id = tp.id
     WHERE tp.user_id = $1
       AND ts.scheduled_date = CURRENT_DATE
       AND ts.status = 'planned'
       AND tp.status = 'active'
     ORDER BY ts.created_at
     LIMIT 1`,
    [userId]
  );
  return result.rows[0] ?? null;
};

export const getUpcomingSessions = async (userId: string): Promise<TrainingSessionRow[]> => {
  const result = await getPool().query<TrainingSessionRow>(
    `SELECT ts.id, ts.plan_id, ts.scheduled_date, ts.session_type,
            ts.target_distance_km, ts.target_duration_min, ts.target_pace_zone,
            ts.target_hr_zone, ts.rpe_target, ts.structure, ts.status,
            ts.completed_run_id, ts.created_at
     FROM training_sessions ts
     JOIN training_plans tp ON ts.plan_id = tp.id
     WHERE tp.user_id = $1
       AND ts.scheduled_date BETWEEN CURRENT_DATE AND CURRENT_DATE + INTERVAL '7 days'
       AND ts.status = 'planned'
       AND tp.status = 'active'
     ORDER BY ts.scheduled_date`,
    [userId]
  );
  return result.rows;
};

export const markSessionComplete = async (
  sessionId: string,
  userId: string,
  runId?: string
): Promise<TrainingSessionRow | null> => {
  const result = await getPool().query<TrainingSessionRow>(
    `UPDATE training_sessions ts
     SET status = 'completed', completed_run_id = $3
     FROM training_plans tp
     WHERE ts.id = $1
       AND ts.plan_id = tp.id
       AND tp.user_id = $2
     RETURNING ts.id, ts.plan_id, ts.scheduled_date, ts.session_type,
               ts.target_distance_km, ts.target_duration_min, ts.status,
               ts.completed_run_id, ts.created_at`,
    [sessionId, userId, runId ?? null]
  );
  return result.rows[0] ?? null;
};

export const markSessionSkipped = async (
  sessionId: string,
  userId: string
): Promise<TrainingSessionRow | null> => {
  const result = await getPool().query<TrainingSessionRow>(
    `UPDATE training_sessions ts
     SET status = 'skipped'
     FROM training_plans tp
     WHERE ts.id = $1
       AND ts.plan_id = tp.id
       AND tp.user_id = $2
     RETURNING ts.id, ts.plan_id, ts.scheduled_date, ts.session_type, ts.status, ts.created_at`,
    [sessionId, userId]
  );
  return result.rows[0] ?? null;
};

export const getSessionById = async (
  sessionId: string
): Promise<(TrainingSessionRow & { user_id: string }) | null> => {
  const result = await getPool().query<TrainingSessionRow & { user_id: string }>(
    `SELECT ts.*, tp.user_id
     FROM training_sessions ts
     JOIN training_plans tp ON ts.plan_id = tp.id
     WHERE ts.id = $1`,
    [sessionId]
  );
  return result.rows[0] ?? null;
};

export const getReadinessScoreFromDb = async (userId: string): Promise<number | null> => {
  const result = await getPool().query<{ score: number }>(
    `SELECT score FROM readiness_scores
     WHERE user_id = $1 AND score_date = CURRENT_DATE
     LIMIT 1`,
    [userId]
  );
  return result.rows[0]?.score ?? null;
};
