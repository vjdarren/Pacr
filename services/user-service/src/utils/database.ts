import { Pool } from 'pg';
import { appConfig } from '../config';
import type { UserRow, RunnerProfileRow, UpdateUserBody, UpdateProfileBody } from '../types';

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

export const getUserById = async (id: string): Promise<UserRow | null> => {
  const result = await getPool().query<UserRow>(
    `SELECT id, email, display_name, subscription_tier, subscription_expiry,
            locale, timezone, onboarding_complete, created_at
     FROM users
     WHERE id = $1 AND deleted_at IS NULL`,
    [id]
  );
  return result.rows[0] ?? null;
};

export const updateUser = async (id: string, fields: UpdateUserBody): Promise<UserRow | null> => {
  const setClauses: string[] = [];
  const values: unknown[] = [];
  let idx = 1;

  if (fields.display_name !== undefined) {
    setClauses.push(`display_name = $${idx++}`);
    values.push(fields.display_name);
  }
  if (fields.locale !== undefined) {
    setClauses.push(`locale = $${idx++}`);
    values.push(fields.locale);
  }
  if (fields.timezone !== undefined) {
    setClauses.push(`timezone = $${idx++}`);
    values.push(fields.timezone);
  }

  if (setClauses.length === 0) return getUserById(id);

  values.push(id);
  const result = await getPool().query<UserRow>(
    `UPDATE users SET ${setClauses.join(', ')}
     WHERE id = $${idx} AND deleted_at IS NULL
     RETURNING id, email, display_name, subscription_tier, subscription_expiry,
               locale, timezone, onboarding_complete, created_at`,
    values
  );
  return result.rows[0] ?? null;
};

export const getRunnerProfile = async (userId: string): Promise<RunnerProfileRow | null> => {
  const result = await getPool().query<RunnerProfileRow>(
    `SELECT user_id, goal_type, target_race_date, experience_level, vo2max_estimate,
            weekly_days, max_session_min, injury_history, available_days, height_cm, weight_kg
     FROM runner_profiles
     WHERE user_id = $1`,
    [userId]
  );
  return result.rows[0] ?? null;
};

export const upsertRunnerProfile = async (
  userId: string,
  fields: UpdateProfileBody
): Promise<RunnerProfileRow> => {
  const cols = Object.keys(fields) as (keyof UpdateProfileBody)[];
  const insertCols = ['user_id', ...cols];
  const insertPlaceholders = insertCols.map((_, i) => `$${i + 1}`).join(', ');
  const values: unknown[] = [userId, ...cols.map((c) => fields[c])];

  const updateClauses = cols.map((c, i) => `${c} = $${i + 2}`).join(', ');

  const result = await getPool().query<RunnerProfileRow>(
    `INSERT INTO runner_profiles (${insertCols.join(', ')})
     VALUES (${insertPlaceholders})
     ON CONFLICT (user_id) DO UPDATE SET ${updateClauses}
     RETURNING user_id, goal_type, target_race_date, experience_level, vo2max_estimate,
               weekly_days, max_session_min, injury_history, available_days, height_cm, weight_kg`,
    values
  );
  return result.rows[0];
};
