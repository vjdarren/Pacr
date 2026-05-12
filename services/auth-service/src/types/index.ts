export interface TokenPair {
  accessToken: string;
  refreshToken: string;
}

export interface JwtPayload {
  sub: string;      // user UUID
  email: string;
  iat?: number;
  exp?: number;
}

export interface RefreshTokenRecord {
  userId: string;
  familyId: string;  // ties all refresh tokens for one login session
  createdAt: number; // unix ms
}

export interface UserRow {
  id: string;
  email: string;
  password_hash: string;
  created_at: Date;
}

export interface HmsTokenInfo {
  sub: string;       // Huawei OpenID
  email?: string;
  display_name?: string;
}

// Extended Fastify request with authenticated user
declare module 'fastify' {
  interface FastifyRequest {
    user?: JwtPayload;
  }
}
