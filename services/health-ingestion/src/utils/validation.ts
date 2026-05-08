import { HealthMetricRecord, MetricType, DbHealthMetric } from '../types';

/**
 * Anomaly detection rules
 */
const isAnomaly = (metricType: MetricType, value: number): { isAnomaly: boolean; reason?: string } => {
  // HRV = 0 is anomalous
  if (metricType === 'hrv_rmssd' && value === 0) {
    return { isAnomaly: true, reason: 'HRV is zero' };
  }

  // Resting HR = 0 is anomalous
  if (metricType === 'resting_hr' && value === 0) {
    return { isAnomaly: true, reason: 'Resting heart rate is zero' };
  }

  // Sleep duration < 60 minutes is anomalous
  if (metricType === 'sleep_duration_min' && value < 60) {
    return { isAnomaly: true, reason: 'Sleep duration less than 60 minutes' };
  }

  // HRV outside reasonable range (typically 20-100ms)
  if (metricType === 'hrv_rmssd' && (value < 0 || value > 200)) {
    return { isAnomaly: true, reason: 'HRV outside reasonable range' };
  }

  // Resting HR outside reasonable range (typically 40-100 bpm)
  if (metricType === 'resting_hr' && (value < 30 || value > 120)) {
    return { isAnomaly: true, reason: 'Resting HR outside reasonable range' };
  }

  // SpO2 outside reasonable range (typically 90-100%)
  if (metricType === 'spo2' && (value < 80 || value > 100)) {
    return { isAnomaly: true, reason: 'SpO2 outside reasonable range' };
  }

  // Sleep quality score outside 0-100 range
  if (metricType === 'sleep_quality' && (value < 0 || value > 100)) {
    return { isAnomaly: true, reason: 'Sleep quality outside valid range' };
  }

  return { isAnomaly: false };
};

/**
 * Convert API health metric to database format with anomaly detection
 */
export const validateAndConvertMetric = (metric: HealthMetricRecord): {
  dbMetric: DbHealthMetric;
  anomalyReason?: string;
} => {
  const anomalyCheck = isAnomaly(metric.metricType, metric.value);

  const dbMetric: DbHealthMetric = {
    user_id: metric.userId,
    recorded_at: new Date(metric.recordedAt),
    metric_type: metric.metricType,
    value: metric.value,
    source: metric.source || 'huawei_health',
    quality_flag: anomalyCheck.isAnomaly ? 'anomaly' : 'valid',
  };

  return {
    dbMetric,
    anomalyReason: anomalyCheck.reason,
  };
};

/**
 * Validate that historical data is within allowed time range
 */
export const validateHistoricalTimeRange = (
  recordedAt: string,
  maxDaysAgo: number
): { valid: boolean; error?: string } => {
  const now = new Date();
  const recordDate = new Date(recordedAt);
  const maxDate = new Date(now.getTime() - maxDaysAgo * 24 * 60 * 60 * 1000);

  if (recordDate > now) {
    return { valid: false, error: 'Recorded date cannot be in the future' };
  }

  if (recordDate < maxDate) {
    return {
      valid: false,
      error: `Historical data limited to ${maxDaysAgo} days ago`,
    };
  }

  return { valid: true };
};

/**
 * Process metrics in batches
 */
export const processBatches = async <T, R>(
  items: T[],
  batchSize: number,
  processor: (batch: T[]) => Promise<R>
): Promise<R[]> => {
  const results: R[] = [];

  for (let i = 0; i < items.length; i += batchSize) {
    const batch = items.slice(i, i + batchSize);
    const result = await processor(batch);
    results.push(result);
  }

  return results;
};
