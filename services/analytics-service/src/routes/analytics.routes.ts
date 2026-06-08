import { FastifyInstance, FastifyRequest } from 'fastify';
import { AnalyticsService } from '../services/analytics.service.js';
import { verifyToken } from '../middleware/verify-token.js';
import { getPool } from '../utils/database.js';
import { getRedis } from '../utils/redis.js';

export async function analyticsRoutes(app: FastifyInstance): Promise<void> {
  const svc = new AnalyticsService(getPool(), getRedis());

  app.get(
    '/api/v1/analytics/progress',
    { preHandler: verifyToken },
    async (request: FastifyRequest, reply) => {
      try {
        const userId = request.user!.sub;
        const data = await svc.getProgress(userId);
        return reply.send({
          success: true,
          data,
          metadata: { timestamp: new Date().toISOString(), requestId: request.id },
        });
      } catch (err) {
        request.log.error(err, 'Failed to get progress');
        return reply.status(500).send({ success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to fetch analytics' } });
      }
    },
  );

  app.get(
    '/api/v1/analytics/trends',
    { preHandler: verifyToken },
    async (request: FastifyRequest, reply) => {
      try {
        const userId = request.user!.sub;
        const data = await svc.getTrends(userId);
        return reply.send({
          success: true,
          data,
          metadata: { timestamp: new Date().toISOString(), requestId: request.id },
        });
      } catch (err) {
        request.log.error(err, 'Failed to get trends');
        return reply.status(500).send({ success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to fetch analytics' } });
      }
    },
  );

  app.get(
    '/api/v1/analytics/race-predictor',
    { preHandler: verifyToken },
    async (request: FastifyRequest, reply) => {
      try {
        const userId = request.user!.sub;
        const data = await svc.getRacePredictor(userId);
        return reply.send({
          success: true,
          data,
          metadata: { timestamp: new Date().toISOString(), requestId: request.id },
        });
      } catch (err) {
        request.log.error(err, 'Failed to get race predictor');
        return reply.status(500).send({ success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to fetch analytics' } });
      }
    },
  );
}
