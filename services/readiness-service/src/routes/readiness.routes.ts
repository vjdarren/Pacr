import { FastifyInstance, FastifyRequest } from 'fastify';
import { z } from 'zod';
import { getTodayReadiness } from '../services/readiness.service';
import { getReadinessHistory } from '../utils/database';
import { ApiSuccessResponse } from '../types';

const UuidParam = z.object({ userId: z.string().uuid() });

const HistoryQuery = z.object({
  limit: z
    .string()
    .optional()
    .transform((v) => Math.min(90, Math.max(1, parseInt(v || '30', 10)))),
  cursor: z.string().optional(),
});

export const readinessRoutes = async (app: FastifyInstance): Promise<void> => {
  app.get(
    '/api/v1/readiness/today/:userId',
    async (
      request: FastifyRequest<{ Params: { userId: string } }>,
      reply
    ) => {
      const parsed = UuidParam.safeParse(request.params);
      if (!parsed.success) {
        return reply.status(400).send({
          success: false,
          error: { code: 'INVALID_USER_ID', message: 'userId must be a valid UUID' },
          metadata: { timestamp: new Date().toISOString(), requestId: request.id },
        });
      }

      const data = await getTodayReadiness(parsed.data.userId);

      const response: ApiSuccessResponse<typeof data> = {
        success: true,
        data,
        metadata: { timestamp: new Date().toISOString(), requestId: request.id },
      };

      return reply.send(response);
    }
  );

  app.get(
    '/api/v1/readiness/history/:userId',
    async (
      request: FastifyRequest<{ Params: { userId: string }; Querystring: Record<string, string> }>,
      reply
    ) => {
      const parsedParams = UuidParam.safeParse(request.params);
      if (!parsedParams.success) {
        return reply.status(400).send({
          success: false,
          error: { code: 'INVALID_USER_ID', message: 'userId must be a valid UUID' },
          metadata: { timestamp: new Date().toISOString(), requestId: request.id },
        });
      }

      const parsedQuery = HistoryQuery.safeParse(request.query);
      if (!parsedQuery.success) {
        return reply.status(400).send({
          success: false,
          error: { code: 'INVALID_QUERY', message: 'Invalid query parameters' },
          metadata: { timestamp: new Date().toISOString(), requestId: request.id },
        });
      }

      const { userId } = parsedParams.data;
      const { limit, cursor } = parsedQuery.data;

      const items = await getReadinessHistory(userId, limit, cursor);

      const nextCursor =
        items.length === limit
          ? (items[items.length - 1].score_date as unknown as Date)
              .toISOString()
              .split('T')[0]
          : null;

      const response: ApiSuccessResponse = {
        success: true,
        data: {
          items: items.map((row) => ({
            scoreDate: (row.score_date as unknown as Date).toISOString().split('T')[0],
            score: row.score,
            overtraining_flag: row.overtraining_flag,
            component_scores: row.component_scores,
            explanation: row.explanation,
            computed_at: (row.computed_at as unknown as Date).toISOString(),
          })),
          cursor: nextCursor,
          hasMore: nextCursor !== null,
        },
        metadata: { timestamp: new Date().toISOString(), requestId: request.id },
      };

      return reply.send(response);
    }
  );
};
