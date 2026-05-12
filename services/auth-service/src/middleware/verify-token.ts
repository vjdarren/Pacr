import type { FastifyRequest, FastifyReply } from 'fastify';
import { verifyAccessToken } from '../services/token.service';

export async function verifyToken(
  request: FastifyRequest,
  reply: FastifyReply
): Promise<void> {
  const authHeader = request.headers.authorization;
  if (!authHeader?.startsWith('Bearer ')) {
    return reply.status(401).send({
      success: false,
      error: { code: 'MISSING_TOKEN', message: 'Authorization header required' },
    });
  }

  const token = authHeader.slice(7);
  try {
    request.user = verifyAccessToken(token);
  } catch {
    return reply.status(401).send({
      success: false,
      error: { code: 'INVALID_TOKEN', message: 'Token is invalid or expired' },
    });
  }
}
