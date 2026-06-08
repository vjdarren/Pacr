export interface JwtPayload {
  sub: string;
  email: string;
  iat?: number;
  exp?: number;
}

export interface RunRecord {
  id: string;
  user_id: string;
  session_id: string | null;
  started_at: Date;
  ended_at: Date | null;
  distance_km: number | null;
  duration_sec: number | null;
  avg_pace_sec_km: number | null;
  avg_hr_bpm: number | null;
  max_hr_bpm: number | null;
  elevation_gain_m: number | null;
  splits: GpsSample[];
  created_at: Date;
}

export interface GpsSample {
  lat: number;
  lng: number;
  altitudeM?: number;
  hrBpm?: number;
  paceSecKm?: number;
  timestamp: string;
}

export interface ActiveRunCache {
  runId: string;
  startedAt: string;
  sessionId: string | null;
}

export interface StartRunBody {
  sessionId?: string;
}

export interface LocationBatchBody {
  samples: GpsSample[];
}

export interface CompleteRunBody {
  distanceKm: number;
  durationSec: number;
  avgPaceSecKm: number;
  avgHrBpm?: number;
  maxHrBpm?: number;
  elevationGainM?: number;
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
  metadata: {
    service: 'run-tracker';
    version: '1.0';
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
