import { readFileSync } from 'fs';
import path from 'path';
import jwt, { type Algorithm } from 'jsonwebtoken';
import type { FastifyRequest, FastifyReply } from 'fastify';
import type { JwtPayload } from '../types';

let _publicKey: string | null = null;

function getPublicKey(): string {
  if (_publicKey) return _publicKey;

  if (process.env.JWT_PUBLIC_KEY) {
    _publicKey = process.env.JWT_PUBLIC_KEY;
    return _publicKey;
  }

  const keyPath =
    process.env.JWT_PUBLIC_KEY_PATH ||
    path.join(process.cwd(), '..', 'auth-service', 'secrets', 'public.pem');

  _publicKey = readFileSync(keyPath, 'utf8');
  return _publicKey;
}

export function verifyAccessToken(token: string): JwtPayload {
  return jwt.verify(token, getPublicKey(), {
    algorithms: ['RS256' as Algorithm],
  }) as JwtPayload;
}

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
