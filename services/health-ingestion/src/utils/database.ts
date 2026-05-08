import { Pool, PoolClient } from 'pg';
import { appConfig } from '../config';
import { DbHealthMetric } from '../types';

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

/**
 * Insert health metrics in batch to TimescaleDB
 */
export const insertHealthMetrics = async (
  metrics: DbHealthMetric[],
  client?: PoolClient
): Promise<number> => {
  if (metrics.length === 0) {
    return 0;
  }

  const dbClient = client || getPool();

  // Build parameterized query for batch insert
  const values: any[] = [];
  const placeholders: string[] = [];

  metrics.forEach((metric, index) => {
    const baseIndex = index * 6;
    placeholders.push(
      `($${baseIndex + 1}, $${baseIndex + 2}, $${baseIndex + 3}, $${baseIndex + 4}, $${baseIndex + 5}, $${baseIndex + 6})`
    );
    values.push(
      metric.user_id,
      metric.recorded_at,
      metric.metric_type,
      metric.value,
      metric.source,
      metric.quality_flag
    );
  });

  const query = `
    INSERT INTO health_metrics (user_id, recorded_at, metric_type, value, source, quality_flag)
    VALUES ${placeholders.join(', ')}
    ON CONFLICT (user_id, recorded_at, metric_type)
    DO UPDATE SET
      value = EXCLUDED.value,
      source = EXCLUDED.source,
      quality_flag = EXCLUDED.quality_flag
  `;

  const result = await dbClient.query(query, values);
  return result.rowCount || 0;
};

/**
 * Get sync status for a user
 */
export const getSyncStatus = async (userId: string) => {
  const pool = getPool();

  // Get last sync timestamp and total records
  const statsQuery = `
    SELECT
      MAX(recorded_at) as last_sync_at,
      COUNT(*) as total_records
    FROM health_metrics
    WHERE user_id = $1
  `;

  const statsResult = await pool.query(statsQuery, [userId]);
  const stats = statsResult.rows[0];

  // Get anomalies in last 7 days
  const anomaliesQuery = `
    SELECT
      metric_type,
      recorded_at,
      value
    FROM health_metrics
    WHERE user_id = $1
      AND quality_flag = 'anomaly'
      AND recorded_at >= NOW() - INTERVAL '7 days'
    ORDER BY recorded_at DESC
    LIMIT 20
  `;

  const anomaliesResult = await pool.query(anomaliesQuery, [userId]);

  return {
    lastSyncAt: stats.last_sync_at,
    totalRecordsIngested: parseInt(stats.total_records || '0', 10),
    anomalies: anomaliesResult.rows,
  };
};

/**
 * Transaction helper
 */
export const withTransaction = async <T>(
  callback: (client: PoolClient) => Promise<T>
): Promise<T> => {
  const client = await getPool().connect();
  try {
    await client.query('BEGIN');
    const result = await callback(client);
    await client.query('COMMIT');
    return result;
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
};
