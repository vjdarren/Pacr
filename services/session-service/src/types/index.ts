export interface JwtPayload {
  sub: string;
  email: string;
  iat?: number;
  exp?: number;
}

export interface TrainingSessionRow {
  id: string;
  plan_id: string;
  scheduled_date: Date;
  session_type: string;
  target_distance_km: number | null;
  target_duration_min: number | null;
  target_pace_zone: string | null;
  target_hr_zone: string | null;
  rpe_target: number | null;
  structure: Record<string, unknown>;
  status: string;
  completed_run_id: string | null;
  created_at: Date;
}

export interface ReadinessCache {
  score: number;
  overtraining_flag: boolean;
}

export interface SessionCompletedEvent {
  eventId: string;
  eventType: 'session.completed';
  timestamp: string;
  userId: string;
  payload: {
    sessionId: string;
    runId: string | null;
    sessionType: string;
  };
  metadata: {
    service: 'session-service';
    version: '1.0';
  };
}

export interface RunCompletedEvent {
  eventId: string;
  eventType: 'run.completed';
  timestamp: string;
  userId: string;
  payload: {
    runId: string;
    sessionId: string | null;
    distanceKm: number;
    durationSec: number;
    avgPaceSecKm: number;
  };
}

export interface ApiSuccessResponse<T = unknown> {
  success: true;
  data: T;
  metadata: {
    timestamp: string;
    requestId: string;
  };
}

declare module 'fastify' {
  interface FastifyRequest {
    user?: JwtPayload;
  }
}
