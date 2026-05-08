import { HealthMetricRecord, DbHealthMetric, SyncStatus } from '../types';
import { validateAndConvertMetric, processBatches, validateHistoricalTimeRange } from '../utils/validation';
import { insertHealthMetrics, getSyncStatus } from '../utils/database';
import { publishHealthIngestedEvent } from '../utils/kafka';
import { appConfig } from '../config';

export interface SyncResult {
  totalRecords: number;
  validRecords: number;
  anomaliesDetected: number;
  recordsInserted: number;
  anomalyDetails: Array<{
    metricType: string;
    value: number;
    recordedAt: string;
    reason: string;
  }>;
}

/**
 * Process and ingest a batch of health metrics
 */
export const syncHealthMetrics = async (
  userId: string,
  metrics: HealthMetricRecord[]
): Promise<SyncResult> => {
  const dbMetrics: DbHealthMetric[] = [];
  const anomalyDetails: SyncResult['anomalyDetails'] = [];

  // Validate and convert each metric
  for (const metric of metrics) {
    const { dbMetric, anomalyReason } = validateAndConvertMetric(metric);
    dbMetrics.push(dbMetric);

    if (anomalyReason) {
      anomalyDetails.push({
        metricType: metric.metricType,
        value: metric.value,
        recordedAt: metric.recordedAt,
        reason: anomalyReason,
      });
    }
  }

  // Insert to database
  const recordsInserted = await insertHealthMetrics(dbMetrics);

  // Calculate stats
  const validRecords = dbMetrics.filter((m) => m.quality_flag === 'valid').length;
  const anomaliesDetected = dbMetrics.filter((m) => m.quality_flag === 'anomaly').length;

  // Get time range for event
  const timestamps = metrics.map((m) => new Date(m.recordedAt).getTime());
  const timeRange = {
    start: new Date(Math.min(...timestamps)).toISOString(),
    end: new Date(Math.max(...timestamps)).toISOString(),
  };

  // Publish Kafka event
  const metricTypes = metrics.map((m) => m.metricType);
  await publishHealthIngestedEvent(
    userId,
    metrics.length,
    anomaliesDetected,
    metricTypes,
    timeRange
  );

  return {
    totalRecords: metrics.length,
    validRecords,
    anomaliesDetected,
    recordsInserted,
    anomalyDetails,
  };
};

/**
 * Process historical data in batches
 */
export const syncHistoricalMetrics = async (
  userId: string,
  metrics: HealthMetricRecord[]
): Promise<SyncResult> => {
  // Validate time range for historical data
  const maxDaysAgo = appConfig.maxHistoricalDays;
  const invalidMetrics: string[] = [];

  for (const metric of metrics) {
    const validation = validateHistoricalTimeRange(metric.recordedAt, maxDaysAgo);
    if (!validation.valid) {
      invalidMetrics.push(
        `${metric.metricType} at ${metric.recordedAt}: ${validation.error}`
      );
    }
  }

  if (invalidMetrics.length > 0) {
    throw new Error(
      `Invalid historical data found: ${invalidMetrics.slice(0, 5).join('; ')}${
        invalidMetrics.length > 5 ? ` and ${invalidMetrics.length - 5} more` : ''
      }`
    );
  }

  const allDbMetrics: DbHealthMetric[] = [];
  const allAnomalyDetails: SyncResult['anomalyDetails'] = [];

  // Validate and convert all metrics
  for (const metric of metrics) {
    const { dbMetric, anomalyReason } = validateAndConvertMetric(metric);
    allDbMetrics.push(dbMetric);

    if (anomalyReason) {
      allAnomalyDetails.push({
        metricType: metric.metricType,
        value: metric.value,
        recordedAt: metric.recordedAt,
        reason: anomalyReason,
      });
    }
  }

  // Process in batches of 500
  const chunkSize = appConfig.historicalBatchChunkSize;
  let totalInserted = 0;

  await processBatches(allDbMetrics, chunkSize, async (batch) => {
    const inserted = await insertHealthMetrics(batch);
    totalInserted += inserted;
    return inserted;
  });

  // Calculate stats
  const validRecords = allDbMetrics.filter((m) => m.quality_flag === 'valid').length;
  const anomaliesDetected = allDbMetrics.filter((m) => m.quality_flag === 'anomaly').length;

  // Get time range for event
  const timestamps = metrics.map((m) => new Date(m.recordedAt).getTime());
  const timeRange = {
    start: new Date(Math.min(...timestamps)).toISOString(),
    end: new Date(Math.max(...timestamps)).toISOString(),
  };

  // Publish Kafka event
  const metricTypes = metrics.map((m) => m.metricType);
  await publishHealthIngestedEvent(
    userId,
    metrics.length,
    anomaliesDetected,
    metricTypes,
    timeRange
  );

  return {
    totalRecords: metrics.length,
    validRecords,
    anomaliesDetected,
    recordsInserted: totalInserted,
    anomalyDetails: allAnomalyDetails.slice(0, 20), // Limit to first 20 anomalies in response
  };
};

/**
 * Get sync status for a user
 */
export const getUserSyncStatus = async (userId: string): Promise<SyncStatus> => {
  const { lastSyncAt, totalRecordsIngested, anomalies } = await getSyncStatus(userId);

  // Format anomalies with reasons
  const recentAnomalies = anomalies.map((anomaly: any) => {
    const { anomalyReason } = validateAndConvertMetric({
      userId,
      metricType: anomaly.metric_type,
      value: parseFloat(anomaly.value),
      recordedAt: anomaly.recorded_at.toISOString(),
      source: 'huawei_health',
    });

    return {
      metricType: anomaly.metric_type,
      recordedAt: anomaly.recorded_at.toISOString(),
      value: parseFloat(anomaly.value),
      reason: anomalyReason || 'Unknown',
    };
  });

  return {
    userId,
    lastSyncAt: lastSyncAt ? lastSyncAt.toISOString() : null,
    totalRecordsIngested,
    anomaliesLast7Days: anomalies.length,
    recentAnomalies,
  };
};
