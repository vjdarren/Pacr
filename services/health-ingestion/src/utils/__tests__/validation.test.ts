import { validateAndConvertMetric, validateHistoricalTimeRange, processBatches } from '../validation';
import { HealthMetricRecord } from '../../types';

describe('Validation Utils', () => {
  describe('validateAndConvertMetric', () => {
    const baseMetric: HealthMetricRecord = {
      userId: '550e8400-e29b-41d4-a716-446655440000',
      recordedAt: '2026-05-08T10:00:00Z',
      metricType: 'hrv_rmssd',
      value: 65,
      source: 'huawei_health',
    };

    it('should mark valid HRV as valid', () => {
      const result = validateAndConvertMetric(baseMetric);

      expect(result.dbMetric.quality_flag).toBe('valid');
      expect(result.anomalyReason).toBeUndefined();
      expect(result.dbMetric.user_id).toBe(baseMetric.userId);
      expect(result.dbMetric.metric_type).toBe(baseMetric.metricType);
      expect(result.dbMetric.value).toBe(baseMetric.value);
    });

    it('should flag HRV = 0 as anomaly', () => {
      const metric = { ...baseMetric, value: 0 };
      const result = validateAndConvertMetric(metric);

      expect(result.dbMetric.quality_flag).toBe('anomaly');
      expect(result.anomalyReason).toBe('HRV is zero');
    });

    it('should flag resting HR = 0 as anomaly', () => {
      const metric = { ...baseMetric, metricType: 'resting_hr' as const, value: 0 };
      const result = validateAndConvertMetric(metric);

      expect(result.dbMetric.quality_flag).toBe('anomaly');
      expect(result.anomalyReason).toBe('Resting heart rate is zero');
    });

    it('should flag sleep duration < 60 minutes as anomaly', () => {
      const metric = { ...baseMetric, metricType: 'sleep_duration_min' as const, value: 45 };
      const result = validateAndConvertMetric(metric);

      expect(result.dbMetric.quality_flag).toBe('anomaly');
      expect(result.anomalyReason).toBe('Sleep duration less than 60 minutes');
    });

    it('should flag HRV outside reasonable range as anomaly', () => {
      const metric1 = { ...baseMetric, value: -5 };
      const result1 = validateAndConvertMetric(metric1);

      expect(result1.dbMetric.quality_flag).toBe('anomaly');
      expect(result1.anomalyReason).toBe('HRV outside reasonable range');

      const metric2 = { ...baseMetric, value: 250 };
      const result2 = validateAndConvertMetric(metric2);

      expect(result2.dbMetric.quality_flag).toBe('anomaly');
      expect(result2.anomalyReason).toBe('HRV outside reasonable range');
    });

    it('should flag resting HR outside reasonable range as anomaly', () => {
      const metric1 = { ...baseMetric, metricType: 'resting_hr' as const, value: 25 };
      const result1 = validateAndConvertMetric(metric1);

      expect(result1.dbMetric.quality_flag).toBe('anomaly');
      expect(result1.anomalyReason).toBe('Resting HR outside reasonable range');

      const metric2 = { ...baseMetric, metricType: 'resting_hr' as const, value: 150 };
      const result2 = validateAndConvertMetric(metric2);

      expect(result2.dbMetric.quality_flag).toBe('anomaly');
      expect(result2.anomalyReason).toBe('Resting HR outside reasonable range');
    });

    it('should flag SpO2 outside reasonable range as anomaly', () => {
      const metric1 = { ...baseMetric, metricType: 'spo2' as const, value: 75 };
      const result1 = validateAndConvertMetric(metric1);

      expect(result1.dbMetric.quality_flag).toBe('anomaly');
      expect(result1.anomalyReason).toBe('SpO2 outside reasonable range');

      const metric2 = { ...baseMetric, metricType: 'spo2' as const, value: 105 };
      const result2 = validateAndConvertMetric(metric2);

      expect(result2.dbMetric.quality_flag).toBe('anomaly');
      expect(result2.anomalyReason).toBe('SpO2 outside reasonable range');
    });

    it('should flag sleep quality outside valid range as anomaly', () => {
      const metric1 = { ...baseMetric, metricType: 'sleep_quality' as const, value: -10 };
      const result1 = validateAndConvertMetric(metric1);

      expect(result1.dbMetric.quality_flag).toBe('anomaly');
      expect(result1.anomalyReason).toBe('Sleep quality outside valid range');

      const metric2 = { ...baseMetric, metricType: 'sleep_quality' as const, value: 150 };
      const result2 = validateAndConvertMetric(metric2);

      expect(result2.dbMetric.quality_flag).toBe('anomaly');
      expect(result2.anomalyReason).toBe('Sleep quality outside valid range');
    });

    it('should convert recordedAt string to Date object', () => {
      const result = validateAndConvertMetric(baseMetric);

      expect(result.dbMetric.recorded_at).toBeInstanceOf(Date);
      expect(result.dbMetric.recorded_at.toISOString()).toContain('2026-05-08T10:00:00');
    });

    it('should use default source if not provided', () => {
      const metricWithoutSource = { ...baseMetric };
      delete (metricWithoutSource as any).source;

      const result = validateAndConvertMetric(metricWithoutSource);

      expect(result.dbMetric.source).toBe('huawei_health');
    });
  });

  describe('validateHistoricalTimeRange', () => {
    it('should accept data within allowed range', () => {
      const twoDaysAgo = new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString();
      const result = validateHistoricalTimeRange(twoDaysAgo, 30);

      expect(result.valid).toBe(true);
      expect(result.error).toBeUndefined();
    });

    it('should reject future dates', () => {
      const tomorrow = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
      const result = validateHistoricalTimeRange(tomorrow, 30);

      expect(result.valid).toBe(false);
      expect(result.error).toBe('Recorded date cannot be in the future');
    });

    it('should reject dates beyond max days ago', () => {
      const fortyDaysAgo = new Date(Date.now() - 40 * 24 * 60 * 60 * 1000).toISOString();
      const result = validateHistoricalTimeRange(fortyDaysAgo, 30);

      expect(result.valid).toBe(false);
      expect(result.error).toBe('Historical data limited to 30 days ago');
    });

    it('should accept data exactly at the boundary', () => {
      const exactlyThirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
      const result = validateHistoricalTimeRange(exactlyThirtyDaysAgo, 30);

      expect(result.valid).toBe(true);
    });
  });

  describe('processBatches', () => {
    it('should process items in batches', async () => {
      const items = Array.from({ length: 10 }, (_, i) => i);
      const batchSize = 3;
      const processedBatches: number[][] = [];

      await processBatches(items, batchSize, async (batch) => {
        processedBatches.push(batch);
        return batch.length;
      });

      expect(processedBatches).toHaveLength(4); // 3+3+3+1
      expect(processedBatches[0]).toEqual([0, 1, 2]);
      expect(processedBatches[1]).toEqual([3, 4, 5]);
      expect(processedBatches[2]).toEqual([6, 7, 8]);
      expect(processedBatches[3]).toEqual([9]);
    });

    it('should return results from each batch', async () => {
      const items = Array.from({ length: 7 }, (_, i) => i);
      const batchSize = 3;

      const results = await processBatches(items, batchSize, async (batch) => {
        return batch.reduce((sum, num) => sum + num, 0);
      });

      expect(results).toHaveLength(3);
      expect(results[0]).toBe(3); // 0+1+2
      expect(results[1]).toBe(12); // 3+4+5
      expect(results[2]).toBe(6); // 6
    });

    it('should handle empty array', async () => {
      const items: number[] = [];
      const results = await processBatches(items, 5, async (batch) => batch.length);

      expect(results).toEqual([]);
    });
  });
});
