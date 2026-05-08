import { syncHealthMetrics, syncHistoricalMetrics } from '../health-sync.service';
import { HealthMetricRecord } from '../../types';
import * as database from '../../utils/database';
import * as kafka from '../../utils/kafka';

// Mock dependencies
jest.mock('../../utils/database');
jest.mock('../../utils/kafka');

describe('HealthSyncService', () => {
  const testUserId = '550e8400-e29b-41d4-a716-446655440000';

  beforeEach(() => {
    jest.clearAllMocks();
    (database.insertHealthMetrics as jest.Mock).mockResolvedValue(5);
    (kafka.publishHealthIngestedEvent as jest.Mock).mockResolvedValue(undefined);
  });

  describe('syncHealthMetrics', () => {
    it('should process valid batch of metrics', async () => {
      const metrics: HealthMetricRecord[] = [
        {
          userId: testUserId,
          recordedAt: '2026-05-08T10:00:00Z',
          metricType: 'hrv_rmssd',
          value: 65,
          source: 'huawei_health',
        },
        {
          userId: testUserId,
          recordedAt: '2026-05-08T10:00:00Z',
          metricType: 'resting_hr',
          value: 55,
          source: 'huawei_health',
        },
      ];

      const result = await syncHealthMetrics(testUserId, metrics);

      expect(result.totalRecords).toBe(2);
      expect(result.validRecords).toBe(2);
      expect(result.anomaliesDetected).toBe(0);
      expect(result.recordsInserted).toBe(5);
      expect(result.anomalyDetails).toHaveLength(0);

      expect(database.insertHealthMetrics).toHaveBeenCalledTimes(1);
      expect(kafka.publishHealthIngestedEvent).toHaveBeenCalledTimes(1);
    });

    it('should detect and flag anomalies', async () => {
      const metrics: HealthMetricRecord[] = [
        {
          userId: testUserId,
          recordedAt: '2026-05-08T10:00:00Z',
          metricType: 'hrv_rmssd',
          value: 0, // Anomaly: HRV is zero
          source: 'huawei_health',
        },
        {
          userId: testUserId,
          recordedAt: '2026-05-08T10:00:00Z',
          metricType: 'resting_hr',
          value: 0, // Anomaly: HR is zero
          source: 'huawei_health',
        },
        {
          userId: testUserId,
          recordedAt: '2026-05-08T10:00:00Z',
          metricType: 'sleep_duration_min',
          value: 45, // Anomaly: < 60 minutes
          source: 'huawei_health',
        },
        {
          userId: testUserId,
          recordedAt: '2026-05-08T10:00:00Z',
          metricType: 'spo2',
          value: 98, // Valid
          source: 'huawei_health',
        },
      ];

      const result = await syncHealthMetrics(testUserId, metrics);

      expect(result.totalRecords).toBe(4);
      expect(result.validRecords).toBe(1);
      expect(result.anomaliesDetected).toBe(3);
      expect(result.anomalyDetails).toHaveLength(3);

      // Check anomaly details
      expect(result.anomalyDetails[0]).toMatchObject({
        metricType: 'hrv_rmssd',
        value: 0,
        reason: 'HRV is zero',
      });
      expect(result.anomalyDetails[1]).toMatchObject({
        metricType: 'resting_hr',
        value: 0,
        reason: 'Resting heart rate is zero',
      });
      expect(result.anomalyDetails[2]).toMatchObject({
        metricType: 'sleep_duration_min',
        value: 45,
        reason: 'Sleep duration less than 60 minutes',
      });
    });

    it('should publish Kafka event with correct data', async () => {
      const metrics: HealthMetricRecord[] = [
        {
          userId: testUserId,
          recordedAt: '2026-05-08T10:00:00Z',
          metricType: 'hrv_rmssd',
          value: 65,
          source: 'huawei_health',
        },
        {
          userId: testUserId,
          recordedAt: '2026-05-08T11:00:00Z',
          metricType: 'resting_hr',
          value: 55,
          source: 'huawei_health',
        },
      ];

      await syncHealthMetrics(testUserId, metrics);

      expect(kafka.publishHealthIngestedEvent).toHaveBeenCalledWith(
        testUserId,
        2, // metrics count
        0, // anomalies count
        ['hrv_rmssd', 'resting_hr'], // metric types
        expect.objectContaining({
          start: expect.any(String),
          end: expect.any(String),
        })
      );
    });

    it('should handle empty metrics array', async () => {
      const metrics: HealthMetricRecord[] = [];

      await expect(syncHealthMetrics(testUserId, metrics)).rejects.toThrow();
    });
  });

  describe('syncHistoricalMetrics', () => {
    it('should process historical data in batches', async () => {
      // Create 600 metrics to test batching (should be 2 batches of 500 each)
      const metrics: HealthMetricRecord[] = Array.from({ length: 600 }, (_, i) => ({
        userId: testUserId,
        recordedAt: new Date(Date.now() - i * 60 * 60 * 1000).toISOString(), // Each hour apart
        metricType: 'hrv_rmssd',
        value: 60 + (i % 20),
        source: 'huawei_health',
      }));

      (database.insertHealthMetrics as jest.Mock).mockResolvedValue(500);

      const result = await syncHistoricalMetrics(testUserId, metrics);

      expect(result.totalRecords).toBe(600);
      expect(result.validRecords).toBe(600);
      expect(result.anomaliesDetected).toBe(0);

      // Should be called twice (600 / 500 chunk size = 2)
      expect(database.insertHealthMetrics).toHaveBeenCalledTimes(2);
    });

    it('should reject future dates', async () => {
      const metrics: HealthMetricRecord[] = [
        {
          userId: testUserId,
          recordedAt: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(), // Tomorrow
          metricType: 'hrv_rmssd',
          value: 65,
          source: 'huawei_health',
        },
      ];

      await expect(syncHistoricalMetrics(testUserId, metrics)).rejects.toThrow(
        'Invalid historical data'
      );
    });

    it('should reject dates beyond 30 days', async () => {
      const metrics: HealthMetricRecord[] = [
        {
          userId: testUserId,
          recordedAt: new Date(Date.now() - 31 * 24 * 60 * 60 * 1000).toISOString(), // 31 days ago
          metricType: 'hrv_rmssd',
          value: 65,
          source: 'huawei_health',
        },
      ];

      await expect(syncHistoricalMetrics(testUserId, metrics)).rejects.toThrow(
        'Invalid historical data'
      );
    });

    it('should accept data exactly at 30 day boundary', async () => {
      const metrics: HealthMetricRecord[] = [
        {
          userId: testUserId,
          recordedAt: new Date(Date.now() - 29 * 24 * 60 * 60 * 1000).toISOString(),
          metricType: 'hrv_rmssd',
          value: 65,
          source: 'huawei_health',
        },
      ];

      (database.insertHealthMetrics as jest.Mock).mockResolvedValue(1);

      const result = await syncHistoricalMetrics(testUserId, metrics);

      expect(result.totalRecords).toBe(1);
      expect(database.insertHealthMetrics).toHaveBeenCalled();
    });

    it('should limit anomaly details to 20 in response', async () => {
      // Create 30 anomalous metrics
      const metrics: HealthMetricRecord[] = Array.from({ length: 30 }, (_, i) => ({
        userId: testUserId,
        recordedAt: new Date(Date.now() - i * 60 * 60 * 1000).toISOString(),
        metricType: 'hrv_rmssd',
        value: 0, // Anomaly
        source: 'huawei_health',
      }));

      (database.insertHealthMetrics as jest.Mock).mockResolvedValue(30);

      const result = await syncHistoricalMetrics(testUserId, metrics);

      expect(result.anomaliesDetected).toBe(30);
      expect(result.anomalyDetails).toHaveLength(20); // Limited to 20
    });
  });
});
