import { Pool } from 'pg';
import { appConfig } from '../config';
import { DbReadinessScore, ReadinessResult } from '../types';

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
  if (!pool) {
    return initDatabase();
  }
  return pool;
};

export const closeDatabase = async (): Promise<void> => {
  if (pool) {
    await pool.end();
  }
};

export const createReadinessScoresTable = async (): Promise<void> => {
  await getPool().query(`
    CREATE TABLE IF NOT EXISTS readiness_scores (
      user_id       UUID             NOT NULL,
      score_date    DATE             NOT NULL DEFAULT CURRENT_DATE,
      score         DOUBLE PRECISION NOT NULL,
      component_scores JSONB         NOT NULL DEFAULT '{}',
      overtraining_flag BOOLEAN      NOT NULL DEFAULT FALSE,
      explanation   TEXT,
      computed_at   TIMESTAMPTZ      NOT NULL DEFAULT NOW(),
      CONSTRAINT readiness_scores_pkey PRIMARY KEY (user_id, score_date)
    );
    CREATE INDEX IF NOT EXISTS idx_readiness_scores_user_date
      ON readiness_scores (user_id, score_date DESC);
  `);
};

// Returns the most recent valid value for each metric type recorded today.
export const fetchTodayMetrics = async (
  userId: string,
  date: string
): Promise<Record<string, number>> => {
  const result = await getPool().query<{ metric_type: string; value: string }>(
    `
    SELECT DISTINCT ON (metric_type) metric_type, value
    FROM health_metrics
    WHERE user_id = $1
      AND recorded_at >= $2::date
      AND recorded_at < ($2::date + INTERVAL '1 day')
      AND quality_flag = 'valid'
    ORDER BY metric_type, recorded_at DESC
    `,
    [userId, date]
  );

  return Object.fromEntries(result.rows.map((r) => [r.metric_type, parseFloat(r.value)]));
};

// Returns average value for each metric type over the 7 days preceding date.
export const fetchSevenDayAvgs = async (
  userId: string,
  date: string
): Promise<Record<string, number>> => {
  const result = await getPool().query<{ metric_type: string; avg_value: string }>(
    `
    SELECT metric_type, AVG(value) AS avg_value
    FROM health_metrics
    WHERE user_id = $1
      AND recorded_at >= ($2::date - INTERVAL '7 days')
      AND recorded_at < $2::date
      AND quality_flag = 'valid'
    GROUP BY metric_type
    `,
    [userId, date]
  );

  return Object.fromEntries(result.rows.map((r) => [r.metric_type, parseFloat(r.avg_value)]));
};

export const upsertReadinessScore = async (
  userId: string,
  date: string,
  result: ReadinessResult
): Promise<void> => {
  await getPool().query(
    `
    INSERT INTO readiness_scores
      (user_id, score_date, score, component_scores, overtraining_flag, explanation, computed_at)
    VALUES ($1, $2, $3, $4, $5, $6, NOW())
    ON CONFLICT (user_id, score_date) DO UPDATE SET
      score             = EXCLUDED.score,
      component_scores  = EXCLUDED.component_scores,
      overtraining_flag = EXCLUDED.overtraining_flag,
      explanation       = EXCLUDED.explanation,
      computed_at       = NOW()
    `,
    [
      userId,
      date,
      result.score,
      JSON.stringify(result.component_scores),
      result.overtraining_flag,
      result.explanation,
    ]
  );
};

export const getReadinessHistory = async (
  userId: string,
  limit: number,
  cursor?: string
): Promise<DbReadinessScore[]> => {
  // Cursor is the score_date of the last item in the previous page (exclusive upper bound).
  // If no cursor, use tomorrow so all records up to and including today are returned.
  const upperBound = cursor || getNextDay(new Date());

  const result = await getPool().query<DbReadinessScore>(
    `
    SELECT user_id, score_date, score, component_scores, overtraining_flag, explanation, computed_at
    FROM readiness_scores
    WHERE user_id = $1
      AND score_date < $2::date
    ORDER BY score_date DESC
    LIMIT $3
    `,
    [userId, upperBound, limit]
  );

  return result.rows;
};

function getNextDay(date: Date): string {
  const next = new Date(date);
  next.setUTCDate(next.getUTCDate() + 1);
  return next.toISOString().split('T')[0];
}
