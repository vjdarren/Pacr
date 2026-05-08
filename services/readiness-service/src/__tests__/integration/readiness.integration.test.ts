import { Pool } from 'pg';
import { config } from 'dotenv';
import { initDatabase, closeDatabase, createReadinessScoresTable } from '../../utils/database';
import { computeAndStoreReadiness } from '../../services/readiness.service';

config();

// Skip integration tests unless DATABASE_URL is set
const shouldRun = process.env.DATABASE_URL !== undefined;

// Mock Redis and Kafka so the integration test only needs the database
jest.mock('../../utils/redis', () => ({
  getCachedReadiness: jest.fn().mockResolvedValue(null),
  setCachedReadiness: jest.fn().mockResolvedValue(undefined),
  invalidateReadinessCache: jest.fn().mockResolvedValue(undefined),
}));

jest.mock('../../utils/kafka', () => ({
  publishReadinessCalculated: jest.fn().mockResolvedValue(undefined),
  getKafkaInstance: jest.fn(),
}));

describe('Readiness Service — Integration Tests', () => {
  const TEST_USER_ID = '550e8400-e29b-41d4-a716-446655440000';
  const TEST_DATE = new Date().toISOString().split('T')[0];

  let pool: Pool;

  beforeAll(async () => {
    if (!shouldRun) {
      console.log('Skipping integration tests — DATABASE_URL not set');
      return;
    }
    pool = initDatabase();
    await createReadinessScoresTable();
  });

  afterAll(async () => {
    if (!shouldRun) return;
    // Clean up any readiness scores written during tests
    await pool.query('DELETE FROM readiness_scores WHERE user_id = $1', [TEST_USER_ID]);
    await closeDatabase();
  });

  beforeEach(async () => {
    if (!shouldRun) return;

    // Remove today's health metrics for test user so we can insert controlled values
    await pool.query(
      `DELETE FROM health_metrics
       WHERE user_id = $1 AND recorded_at >= $2::date`,
      [TEST_USER_ID, TEST_DATE]
    );

    // Remove any prior readiness score for today
    await pool.query(
      'DELETE FROM readiness_scores WHERE user_id = $1 AND score_date = $2',
      [TEST_USER_ID, TEST_DATE]
    );

    // Insert a known 7-day history (days 1–7) for deterministic averages
    const historicalRows = Array.from({ length: 7 }, (_, i) => ({
      offset: i + 1,
      hrv: 60,
      rhr: 56,
      sleepQuality: 70,
      sleepDuration: 420,
    }));

    for (const row of historicalRows) {
      await pool.query(
        `
        INSERT INTO health_metrics (user_id, recorded_at, metric_type, value, source, quality_flag)
        VALUES
          ($1, NOW() - INTERVAL '${row.offset} days', 'hrv_rmssd',         $2, 'test', 'valid'),
          ($1, NOW() - INTERVAL '${row.offset} days', 'resting_hr',         $3, 'test', 'valid'),
          ($1, NOW() - INTERVAL '${row.offset} days', 'sleep_quality',      $4, 'test', 'valid'),
          ($1, NOW() - INTERVAL '${row.offset} days', 'sleep_duration_min', $5, 'test', 'valid')
        ON CONFLICT (user_id, recorded_at, metric_type) DO UPDATE SET
          value = EXCLUDED.value, source = EXCLUDED.source
        `,
        [TEST_USER_ID, row.hrv, row.rhr, row.sleepQuality, row.sleepDuration]
      );
    }

    // Insert today's metrics with known values
    await pool.query(
      `
      INSERT INTO health_metrics (user_id, recorded_at, metric_type, value, source, quality_flag)
      VALUES
        ($1, NOW(), 'hrv_rmssd',         65, 'test', 'valid'),
        ($1, NOW(), 'resting_hr',         55, 'test', 'valid'),
        ($1, NOW(), 'sleep_quality',      75, 'test', 'valid'),
        ($1, NOW(), 'sleep_duration_min', 450, 'test', 'valid')
      ON CONFLICT (user_id, recorded_at, metric_type) DO UPDATE SET
        value = EXCLUDED.value, source = EXCLUDED.source
      `,
      [TEST_USER_ID]
    );
  });

  (shouldRun ? it : it.skip)(
    'computes readiness from seeded health_metrics and returns expected score',
    async () => {
      // 7-day avgs: hrv=60, rhr=56, sleepQuality=70, sleepDuration=420
      // Today:      hrv=65, rhr=55, sleepQuality=75, sleepDuration=450
      // hrv: 65>=60 → 100, sleepQuality: 75, rhr: 55<=56 → 100, sleepDuration: 450>=420 → 100
      // stress: no data → excluded (total weight = 0.90)
      // score = 100*(0.30/0.90) + 75*(0.25/0.90) + 100*(0.20/0.90) + 100*(0.15/0.90)
      //       ≈ 93.056
      const result = await computeAndStoreReadiness(TEST_USER_ID, TEST_DATE);

      expect(result.score).toBeCloseTo(93.056, 1);
      expect(result.overtraining_flag).toBe(false);
      expect(typeof result.explanation).toBe('string');
      expect(result.explanation.length).toBeGreaterThan(0);
    },
    30000
  );

  (shouldRun ? it : it.skip)(
    'component breakdown reflects correct hasData flags',
    async () => {
      const result = await computeAndStoreReadiness(TEST_USER_ID, TEST_DATE);

      expect(result.component_scores.hrv.hasData).toBe(true);
      expect(result.component_scores.sleepQuality.hasData).toBe(true);
      expect(result.component_scores.rhr.hasData).toBe(true);
      expect(result.component_scores.sleepDuration.hasData).toBe(true);
      // stress_score was not inserted
      expect(result.component_scores.stress.hasData).toBe(false);
    },
    30000
  );

  (shouldRun ? it : it.skip)(
    'sets overtraining_flag when today HRV is >15% below 7-day avg',
    async () => {
      // Override today's HRV to 50 (7-day avg = 60, drop = 16.7%)
      await pool.query(
        `UPDATE health_metrics
         SET value = 50
         WHERE user_id = $1
           AND metric_type = 'hrv_rmssd'
           AND recorded_at >= $2::date`,
        [TEST_USER_ID, TEST_DATE]
      );

      const result = await computeAndStoreReadiness(TEST_USER_ID, TEST_DATE);
      expect(result.overtraining_flag).toBe(true);
    },
    30000
  );

  (shouldRun ? it : it.skip)(
    'score is clamped to 0–100 regardless of metric values',
    async () => {
      const result = await computeAndStoreReadiness(TEST_USER_ID, TEST_DATE);
      expect(result.score).toBeGreaterThanOrEqual(0);
      expect(result.score).toBeLessThanOrEqual(100);
    },
    30000
  );

  (shouldRun ? it : it.skip)(
    'persists the readiness score to the readiness_scores table',
    async () => {
      await computeAndStoreReadiness(TEST_USER_ID, TEST_DATE);

      const dbResult = await pool.query(
        'SELECT score, overtraining_flag FROM readiness_scores WHERE user_id = $1 AND score_date = $2',
        [TEST_USER_ID, TEST_DATE]
      );

      expect(dbResult.rows).toHaveLength(1);
      expect(typeof dbResult.rows[0].score).toBe('number');
      expect(typeof dbResult.rows[0].overtraining_flag).toBe('boolean');
    },
    30000
  );
});
