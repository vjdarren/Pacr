export interface JwtPayload {
  sub: string;
  email: string;
  iat?: number;
  exp?: number;
}

// Extended Fastify request with authenticated user
declare module 'fastify' {
  interface FastifyRequest {
    user?: JwtPayload;
  }
}
