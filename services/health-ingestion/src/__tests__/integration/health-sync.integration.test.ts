import { Pool } from 'pg';
import { config } from 'dotenv';
import { HealthMetricRecord } from '../../types';
import { syncHealthMetrics } from '../../services/health-sync.service';
import { initDatabase, closeDatabase } from '../../utils/database';

// Load test environment
config();

// Skip integration tests if DATABASE_URL is not set
const shouldRunIntegrationTests = process.env.DATABASE_URL !== undefined;

describe('Health Sync Integration Tests', () => {
  const testUserId = '550e8400-e29b-41d4-a716-446655440000';
  let pool: Pool;

  beforeAll(async () => {
    if (!shouldRunIntegrationTests) {
      console.log('Skipping integration tests - DATABASE_URL not set');
      return;
    }

    pool = initDatabase();
  });

  afterAll(async () => {
    if (shouldRunIntegrationTests) {
      await closeDatabase();
    }
  });

  beforeEach(async () => {
    if (!shouldRunIntegrationTests) {
      return;
    }

    // Clean up test data before each test
    await pool.query(
      `DELETE FROM health_metrics WHERE user_id = $1 AND recorded_at >= NOW() - INTERVAL '1 hour'`,
      [testUserId]
    );
  });

  (shouldRunIntegrationTests ? it : it.skip)(
    'should insert batch of metrics to database and verify',
    async () => {
      const now = new Date();
      const metrics: HealthMetricRecord[] = [
        {
          userId: testUserId,
          recordedAt: new Date(now.getTime() - 10 * 60 * 1000).toISOString(), // 10 mins ago
          metricType: 'hrv_rmssd',
          value: 65,
          source: 'test_source',
        },
        {
          userId: testUserId,
          recordedAt: new Date(now.getTime() - 9 * 60 * 1000).toISOString(), // 9 mins ago
          metricType: 'resting_hr',
          value: 55,
          source: 'test_source',
        },
        {
          userId: testUserId,
          recordedAt: new Date(now.getTime() - 8 * 60 * 1000).toISOString(), // 8 mins ago
          metricType: 'sleep_quality',
          value: 75,
          source: 'test_source',
        },
        {
          userId: testUserId,
          recordedAt: new Date(now.getTime() - 7 * 60 * 1000).toISOString(), // 7 mins ago
          metricType: 'spo2',
          value: 98,
          source: 'test_source',
        },
      ];

      // Mock Kafka to avoid needing Kafka running for integration tests
      jest.mock('../../utils/kafka', () => ({
        publishHealthIngestedEvent: jest.fn().mockResolvedValue(undefined),
      }));

      // Sync the metrics
      const result = await syncHealthMetrics(testUserId, metrics);

      // Verify result
      expect(result.totalRecords).toBe(4);
      expect(result.validRecords).toBe(4);
      expect(result.anomaliesDetected).toBe(0);
      expect(result.recordsInserted).toBeGreaterThan(0);

      // Verify data in database
      const dbResult = await pool.query(
        `SELECT user_id, metric_type, value, source, quality_flag
         FROM health_metrics
         WHERE user_id = $1
           AND recorded_at >= NOW() - INTERVAL '15 minutes'
           AND source = 'test_source'
         ORDER BY recorded_at`,
        [testUserId]
      );

      expect(dbResult.rows).toHaveLength(4);

      // Verify each metric
      expect(dbResult.rows[0]).toMatchObject({
        user_id: testUserId,
        metric_type: 'hrv_rmssd',
        value: 65,
        source: 'test_source',
        quality_flag: 'valid',
      });

      expect(dbResult.rows[1]).toMatchObject({
        user_id: testUserId,
        metric_type: 'resting_hr',
        value: 55,
        source: 'test_source',
        quality_flag: 'valid',
      });

      expect(dbResult.rows[2]).toMatchObject({
        user_id: testUserId,
        metric_type: 'sleep_quality',
        value: 75,
        source: 'test_source',
        quality_flag: 'valid',
      });

      expect(dbResult.rows[3]).toMatchObject({
        user_id: testUserId,
        metric_type: 'spo2',
        value: 98,
        source: 'test_source',
        quality_flag: 'valid',
      });
    },
    30000 // 30 second timeout for integration test
  );

  (shouldRunIntegrationTests ? it : it.skip)(
    'should flag anomalies correctly in database',
    async () => {
      const now = new Date();
      const metrics: HealthMetricRecord[] = [
        {
          userId: testUserId,
          recordedAt: new Date(now.getTime() - 5 * 60 * 1000).toISOString(),
          metricType: 'hrv_rmssd',
          value: 0, // Anomaly
          source: 'test_source_anomaly',
        },
        {
          userId: testUserId,
          recordedAt: new Date(now.getTime() - 4 * 60 * 1000).toISOString(),
          metricType: 'resting_hr',
          value: 0, // Anomaly
          source: 'test_source_anomaly',
        },
        {
          userId: testUserId,
          recordedAt: new Date(now.getTime() - 3 * 60 * 1000).toISOString(),
          metricType: 'sleep_duration_min',
          value: 30, // Anomaly (< 60)
          source: 'test_source_anomaly',
        },
      ];

      // Mock Kafka
      jest.mock('../../utils/kafka', () => ({
        publishHealthIngestedEvent: jest.fn().mockResolvedValue(undefined),
      }));

      // Sync the metrics
      const result = await syncHealthMetrics(testUserId, metrics);

      // Verify anomalies detected
      expect(result.anomaliesDetected).toBe(3);
      expect(result.validRecords).toBe(0);

      // Verify in database
      const dbResult = await pool.query(
        `SELECT metric_type, value, quality_flag
         FROM health_metrics
         WHERE user_id = $1
           AND source = 'test_source_anomaly'
         ORDER BY recorded_at`,
        [testUserId]
      );

      expect(dbResult.rows).toHaveLength(3);
      expect(dbResult.rows.every((row) => row.quality_flag === 'anomaly')).toBe(true);
    },
    30000
  );

  (shouldRunIntegrationTests ? it : it.skip)(
    'should handle upsert on conflict (same user_id, recorded_at, metric_type)',
    async () => {
      const recordedAt = new Date(Date.now() - 2 * 60 * 1000).toISOString();
      const metric1: HealthMetricRecord = {
        userId: testUserId,
        recordedAt,
        metricType: 'hrv_rmssd',
        value: 60,
        source: 'test_upsert_1',
      };

      // Mock Kafka
      jest.mock('../../utils/kafka', () => ({
        publishHealthIngestedEvent: jest.fn().mockResolvedValue(undefined),
      }));

      // Insert first time
      await syncHealthMetrics(testUserId, [metric1]);

      // Insert again with updated value (should upsert)
      const metric2: HealthMetricRecord = {
        ...metric1,
        value: 70,
        source: 'test_upsert_2',
      };

      await syncHealthMetrics(testUserId, [metric2]);

      // Verify only one row exists with updated value
      const dbResult = await pool.query(
        `SELECT value, source
         FROM health_metrics
         WHERE user_id = $1
           AND metric_type = 'hrv_rmssd'
           AND recorded_at = $2`,
        [testUserId, new Date(recordedAt)]
      );

      expect(dbResult.rows).toHaveLength(1);
      expect(dbResult.rows[0].value).toBe(70);
      expect(dbResult.rows[0].source).toBe('test_upsert_2');
    },
    30000
  );
});
