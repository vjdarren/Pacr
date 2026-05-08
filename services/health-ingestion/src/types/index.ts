import { z } from 'zod';

// Metric type enum matching the database
export const MetricTypeEnum = z.enum([
  'hrv_rmssd',
  'resting_hr',
  'sleep_quality',
  'sleep_duration_min',
  'deep_sleep_min',
  'rem_sleep_min',
  'spo2',
  'stress_score',
  'vo2max',
  'cadence',
  'ground_contact_ms',
  'stride_length_cm',
  'vertical_oscillation_cm',
]);

export type MetricType = z.infer<typeof MetricTypeEnum>;

// Quality flag enum
export const QualityFlagEnum = z.enum(['valid', 'anomaly', 'estimated']);
export type QualityFlag = z.infer<typeof QualityFlagEnum>;

// Health metric record schema
export const HealthMetricRecordSchema = z.object({
  userId: z.string().uuid(),
  recordedAt: z.string().datetime(),
  metricType: MetricTypeEnum,
  value: z.number().finite(),
  source: z.string().optional().default('huawei_health'),
});

export type HealthMetricRecord = z.infer<typeof HealthMetricRecordSchema>;

// Batch sync request schema
export const HealthSyncBatchSchema = z.object({
  userId: z.string().uuid(),
  metrics: z.array(HealthMetricRecordSchema).min(1).max(100),
});

export type HealthSyncBatch = z.infer<typeof HealthSyncBatchSchema>;

// Historical sync request schema (larger batch)
export const HistoricalSyncBatchSchema = z.object({
  userId: z.string().uuid(),
  metrics: z.array(HealthMetricRecordSchema).min(1).max(15000), // Up to 30 days * 500
});

export type HistoricalSyncBatch = z.infer<typeof HistoricalSyncBatchSchema>;

// Database health metric
export interface DbHealthMetric {
  user_id: string;
  recorded_at: Date;
  metric_type: MetricType;
  value: number;
  source: string;
  quality_flag: QualityFlag;
}

// Sync status response
export interface SyncStatus {
  userId: string;
  lastSyncAt: string | null;
  totalRecordsIngested: number;
  anomaliesLast7Days: number;
  recentAnomalies: Array<{
    metricType: MetricType;
    recordedAt: string;
    value: number;
    reason: string;
  }>;
}

// Kafka event payload
export interface HealthIngestedEvent {
  eventId: string;
  eventType: 'health.ingested';
  timestamp: string;
  userId: string;
  payload: {
    metricsCount: number;
    anomaliesCount: number;
    metricTypes: MetricType[];
    timeRange: {
      start: string;
      end: string;
    };
  };
  metadata: {
    service: 'health-ingestion';
    version: '1.0';
  };
}

// API Response types
export interface ApiSuccessResponse<T = unknown> {
  success: true;
  data: T;
  metadata: {
    timestamp: string;
    requestId: string;
  };
}

export interface ApiErrorResponse {
  success: false;
  error: {
    code: string;
    message: string;
    details?: unknown;
  };
  metadata: {
    timestamp: string;
    requestId: string;
  };
}

export type ApiResponse<T = unknown> = ApiSuccessResponse<T> | ApiErrorResponse;
