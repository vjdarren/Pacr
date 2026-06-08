import { FastifyInstance, FastifyRequest } from 'fastify';
import { z } from 'zod';
import { verifyToken } from '../middleware/verify-token';
import {
  getTodaySession,
  getUpcomingSessions,
  markSessionComplete,
  markSessionSkipped,
  getReadinessScoreFromDb,
} from '../utils/database';
import { getCachedReadiness } from '../utils/redis';
import { publishSessionCompleted } from '../utils/kafka';
import type { ApiSuccessResponse } from '../types';

const UuidParam = z.object({ id: z.string().uuid() });

const CompleteBody = z.object({
  runId: z.string().uuid().optional(),
});

export const sessionsRoutes = async (app: FastifyInstance): Promise<void> => {
  app.get(
    '/api/v1/sessions/today',
    { preHandler: verifyToken },
    async (request: FastifyRequest, reply) => {
      const userId = request.user!.sub;

      // Safety guardrail: readiness < 30 → rest day regardless of plan
      let readinessScore: number | null = null;
      try {
        const cached = await getCachedReadiness(userId);
        readinessScore = cached?.score ?? (await getReadinessScoreFromDb(userId));
      } catch {
        // Redis/DB unavailable — proceed without guardrail (fail open, not closed)
      }

      if (readinessScore !== null && readinessScore < 30) {
        const response: ApiSuccessResponse = {
          success: true,
          data: {
            sessionType: 'rest',
            guardrailApplied: true,
            readinessScore,
            message: 'Your readiness score is low. Rest today to aid recovery.',
          },
          metadata: { timestamp: new Date().toISOString(), requestId: request.id },
        };
        return reply.send(response);
      }

      const session = await getTodaySession(userId);

      const response: ApiSuccessResponse = {
        success: true,
        data: session,
        metadata: { timestamp: new Date().toISOString(), requestId: request.id },
      };
      return reply.send(response);
    }
  );

  app.get(
    '/api/v1/sessions/upcoming',
    { preHandler: verifyToken },
    async (request: FastifyRequest, reply) => {
      const userId = request.user!.sub;
      const sessions = await getUpcomingSessions(userId);

      const response: ApiSuccessResponse = {
        success: true,
        data: sessions,
        metadata: { timestamp: new Date().toISOString(), requestId: request.id },
      };
      return reply.send(response);
    }
  );

  app.patch(
    '/api/v1/sessions/:id/complete',
    { preHandler: verifyToken },
    async (request: FastifyRequest, reply) => {
      const userId = request.user!.sub;

      const parsedParam = UuidParam.safeParse(request.params);
      if (!parsedParam.success) {
        return reply.status(400).send({
          success: false,
          error: { code: 'INVALID_SESSION_ID', message: 'Session ID must be a valid UUID' },
          metadata: { timestamp: new Date().toISOString(), requestId: request.id },
        });
      }

      const parsedBody = CompleteBody.safeParse(request.body ?? {});
      if (!parsedBody.success) {
        return reply.status(400).send({
          success: false,
          error: { code: 'INVALID_BODY', message: parsedBody.error.message },
          metadata: { timestamp: new Date().toISOString(), requestId: request.id },
        });
      }

      const session = await markSessionComplete(
        parsedParam.data.id,
        userId,
        parsedBody.data.runId
      );

      if (!session) {
        return reply.status(404).send({
          success: false,
          error: { code: 'SESSION_NOT_FOUND', message: 'Session not found or already updated' },
          metadata: { timestamp: new Date().toISOString(), requestId: request.id },
        });
      }

      await publishSessionCompleted(
        userId,
        session.id,
        session.session_type,
        parsedBody.data.runId
      );

      const response: ApiSuccessResponse = {
        success: true,
        data: session,
        metadata: { timestamp: new Date().toISOString(), requestId: request.id },
      };
      return reply.send(response);
    }
  );

  app.patch(
    '/api/v1/sessions/:id/skip',
    { preHandler: verifyToken },
    async (request: FastifyRequest, reply) => {
      const userId = request.user!.sub;

      const parsedParam = UuidParam.safeParse(request.params);
      if (!parsedParam.success) {
        return reply.status(400).send({
          success: false,
          error: { code: 'INVALID_SESSION_ID', message: 'Session ID must be a valid UUID' },
          metadata: { timestamp: new Date().toISOString(), requestId: request.id },
        });
      }

      const session = await markSessionSkipped(parsedParam.data.id, userId);

      if (!session) {
        return reply.status(404).send({
          success: false,
          error: { code: 'SESSION_NOT_FOUND', message: 'Session not found or already updated' },
          metadata: { timestamp: new Date().toISOString(), requestId: request.id },
        });
      }

      const response: ApiSuccessResponse = {
        success: true,
        data: session,
        metadata: { timestamp: new Date().toISOString(), requestId: request.id },
      };
      return reply.send(response);
    }
  );
};
