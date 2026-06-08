export interface JwtPayload {
  sub: string;
  email: string;
  iat?: number;
  exp?: number;
}

export interface UserRow {
  id: string;
  email: string;
  display_name: string | null;
  subscription_tier: 'free' | 'pro' | 'elite';
  subscription_expiry: Date | null;
  locale: string;
  timezone: string;
  onboarding_complete: boolean;
  created_at: Date;
}

export interface RunnerProfileRow {
  user_id: string;
  goal_type: string | null;
  target_race_date: Date | null;
  experience_level: string | null;
  vo2max_estimate: number | null;
  weekly_days: number | null;
  max_session_min: number | null;
  injury_history: unknown[];
  available_days: string[] | null;
  height_cm: number | null;
  weight_kg: number | null;
}

export interface UpdateUserBody {
  display_name?: string;
  locale?: string;
  timezone?: string;
}

export interface UpdateProfileBody {
  goal_type?: string;
  target_race_date?: string;
  experience_level?: string;
  weekly_days?: number;
  max_session_min?: number;
  available_days?: string[];
  height_cm?: number;
  weight_kg?: number;
}

export interface ApiSuccessResponse<T = unknown> {
  success: true;
  data: T;
  metadata: {
    timestamp: string;
    requestId: string;
  };
}

// Extended Fastify request with authenticated user
declare module 'fastify' {
  interface FastifyRequest {
    user?: JwtPayload;
  }
}
