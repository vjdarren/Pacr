import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { z } from 'zod';
import { register, login, refresh, logout, hmsLogin, AuthError } from '../services/auth.service';
import { verifyToken } from '../middleware/verify-token';
import { checkRateLimit, recordFailure, clearRateLimit } from '../services/rate-limit.service';
import { getPool } from '../utils/database';
import type { UserRow } from '../types';

const RegisterBody = z.object({
  email: z.string().email(),
  password: z.string().min(8).max(128),
});

const LoginBody = z.object({
  email: z.string().email(),
  password: z.string(),
});

const RefreshBody = z.object({
  refreshToken: z.string().uuid(),
});

const LogoutBody = z.object({
  refreshToken: z.string().uuid(),
});

const HmsBody = z.object({
  accessToken: z.string().min(1),
});

function getClientIp(request: FastifyRequest): string {
  return (
    (request.headers['x-forwarded-for'] as string | undefined)?.split(',')[0]?.trim() ??
    request.ip
  );
}

function ok(data: unknown) {
  return {
    success: true,
    data,
    metadata: { timestamp: new Date().toISOString() },
  };
}

function authErrorReply(reply: FastifyReply, err: unknown) {
  if (err instanceof AuthError) {
    return reply.status(err.statusCode).send({
      success: false,
      error: { code: err.code, message: err.message },
    });
  }
  return reply.status(500).send({
    success: false,
    error: { code: 'INTERNAL_ERROR', message: 'An unexpected error occurred' },
  });
}

export async function authRoutes(app: FastifyInstance): Promise<void> {
  // POST /api/v1/auth/register
  app.post('/api/v1/auth/register', async (request: FastifyRequest, reply: FastifyReply) => {
    const parsed = RegisterBody.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({
        success: false,
        error: { code: 'VALIDATION_ERROR', message: parsed.error.message },
      });
    }

    const { email, password } = parsed.data;

    try {
      const tokens = await register(email, password);
      return reply.status(201).send(ok(tokens));
    } catch (err) {
      return authErrorReply(reply, err);
    }
  });

  // POST /api/v1/auth/login
  app.post('/api/v1/auth/login', async (request: FastifyRequest, reply: FastifyReply) => {
    const ip = getClientIp(request);

    const rateCheck = await checkRateLimit(ip);
    if (rateCheck.blocked) {
      return reply.status(429).send({
        success: false,
        error: { code: 'RATE_LIMITED', message: 'Too many failed attempts. Try again later.' },
      });
    }

    const parsed = LoginBody.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({
        success: false,
        error: { code: 'VALIDATION_ERROR', message: parsed.error.message },
      });
    }

    const { email, password } = parsed.data;

    try {
      const tokens = await login(email, password);
      await clearRateLimit(ip);
      return reply.send(ok(tokens));
    } catch (err) {
      if (err instanceof AuthError && err.code === 'INVALID_CREDENTIALS') {
        const limitResult = await recordFailure(ip);
        if (limitResult.blocked) {
          return reply.status(429).send({
            success: false,
            error: {
              code: 'RATE_LIMITED',
              message: 'Too many failed attempts. Account temporarily locked.',
            },
          });
        }
      }
      return authErrorReply(reply, err);
    }
  });

  // POST /api/v1/auth/refresh
  app.post('/api/v1/auth/refresh', async (request: FastifyRequest, reply: FastifyReply) => {
    const parsed = RefreshBody.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({
        success: false,
        error: { code: 'VALIDATION_ERROR', message: parsed.error.message },
      });
    }

    try {
      const tokens = await refresh(parsed.data.refreshToken);
      return reply.send(ok(tokens));
    } catch (err) {
      return authErrorReply(reply, err);
    }
  });

  // POST /api/v1/auth/logout
  app.post('/api/v1/auth/logout', async (request: FastifyRequest, reply: FastifyReply) => {
    const parsed = LogoutBody.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({
        success: false,
        error: { code: 'VALIDATION_ERROR', message: parsed.error.message },
      });
    }

    await logout(parsed.data.refreshToken);
    return reply.send(ok({ message: 'Logged out' }));
  });

  // POST /api/v1/auth/hms
  app.post('/api/v1/auth/hms', async (request: FastifyRequest, reply: FastifyReply) => {
    const parsed = HmsBody.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({
        success: false,
        error: { code: 'VALIDATION_ERROR', message: parsed.error.message },
      });
    }

    try {
      const tokens = await hmsLogin(parsed.data.accessToken);
      return reply.send(ok(tokens));
    } catch (err) {
      return authErrorReply(reply, err);
    }
  });

  // GET /api/v1/auth/me  (requires valid JWT)
  app.get(
    '/api/v1/auth/me',
    { preHandler: verifyToken },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const userId = request.user!.sub;
      const db = getPool();

      const result = await db.query<UserRow>(
        'SELECT id, email, created_at FROM users WHERE id = $1 AND deleted_at IS NULL',
        [userId]
      );

      const user = result.rows[0];
      if (!user) {
        return reply.status(404).send({
          success: false,
          error: { code: 'USER_NOT_FOUND', message: 'User not found' },
        });
      }

      return reply.send(
        ok({ id: user.id, email: user.email, createdAt: user.created_at })
      );
    }
  );
}
