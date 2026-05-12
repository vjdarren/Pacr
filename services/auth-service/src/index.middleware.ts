// Re-export for other Fastify services to import verifyToken directly.
// Usage: import { verifyToken } from '@pacr/auth-service/middleware'
export { verifyToken } from './middleware/verify-token';
export { verifyAccessToken } from './services/token.service';
export type { JwtPayload } from './types';
