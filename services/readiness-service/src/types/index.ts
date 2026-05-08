// Raw health data inputs to the scoring algorithm
export interface HealthData {
  hrv?: number;
  hrv7DayAvg?: number;
  sleepQuality?: number;
  rhr?: number;
  rhr7DayAvg?: number;
  sleepDuration?: number;
  stressScore?: number;
}

// Per-component scoring result
export interface ComponentScore {
  score: number;
  weight: number;
  hasData: boolean;
}

export interface ComponentScores {
  hrv: ComponentScore;
  sleepQuality: ComponentScore;
  rhr: ComponentScore;
  sleepDuration: ComponentScore;
  stress: ComponentScore;
}

// Full readiness computation result
export interface ReadinessResult {
  score: number;
  overtraining_flag: boolean;
  component_scores: ComponentScores;
  explanation: string;
}

// Database row shape
export interface DbReadinessScore {
  user_id: string;
  score_date: Date;
  score: number;
  component_scores: ComponentScores;
  overtraining_flag: boolean;
  explanation: string;
  computed_at: Date;
}

// Kafka event published after each computation
export interface ReadinessCalculatedEvent {
  eventId: string;
  eventType: 'readiness.calculated';
  timestamp: string;
  userId: string;
  payload: {
    score: number;
    overtraining_flag: boolean;
    component_scores: ComponentScores;
    computed_at: string;
  };
  metadata: {
    service: 'readiness-service';
    version: '1.0';
  };
}

// Kafka event consumed from health-ingestion
export interface HealthIngestedEvent {
  eventId: string;
  eventType: 'health.ingested';
  timestamp: string;
  userId: string;
  payload: {
    metricsCount: number;
    anomaliesCount: number;
    metricTypes: string[];
    timeRange: { start: string; end: string };
  };
}

// API response shapes
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
