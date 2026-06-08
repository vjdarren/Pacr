export interface JwtPayload {
  sub: string;
  email: string;
  iat?: number;
  exp?: number;
}

export interface ProgressSummary {
  userId: string;
  weeklyDistanceKm: number;
  sessionsCompleted: number;
  sessionTarget: number;
  currentStreakDays: number;
  totalRunsAllTime: number;
}

export interface TrendPoint {
  date: string;
  value: number;
}

export interface TrendData {
  userId: string;
  vo2maxTrend: TrendPoint[];
  paceTrend: TrendPoint[];
}

export interface RacePrediction {
  distance: string;
  predictedTime: string;
  vdot: number;
  confidenceNote: string;
}

export interface RacePredictor {
  userId: string;
  currentVdot: number;
  predictions: RacePrediction[];
}

// Extended Fastify request with authenticated user
declare module 'fastify' {
  interface FastifyRequest {
    user?: JwtPayload;
  }
}
