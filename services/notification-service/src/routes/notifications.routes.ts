import { FastifyInstance } from 'fastify';
import { Pool } from 'pg';
import { z } from 'zod';
import { NotificationService } from '../services/notification.service.js';
import { verifyToken } from '../middleware/verify-token.js';

const UpdateTokenSchema = z.object({ fcmToken: z.string().min(1) });

export async function notificationRoutes(app: FastifyInstance, { db }: { db: Pool }): Promise<void> {
  const svc = new NotificationService(db);

  app.addHook('preHandler', verifyToken);

  app.put('/api/v1/notifications/token', async (request, reply) => {
    try {
      const userId = request.user!.sub;
      const { fcmToken } = UpdateTokenSchema.parse(request.body);
      await svc.updateFcmToken(userId, fcmToken);
      return reply.send({
        success: true,
        data: null,
        metadata: { timestamp: new Date().toISOString() },
      });
    } catch (err) {
      request.log.error(err, 'Failed to update FCM token');
      return reply
        .status(500)
        .send({ success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to update token' } });
    }
  });

  app.get('/api/v1/notifications/history', async (request, reply) => {
    try {
      const userId = request.user!.sub;
      const res = await db.query(
        `SELECT id, notification_type, title, body, sent_at
         FROM notification_history
         WHERE user_id = $1 ORDER BY sent_at DESC LIMIT 50`,
        [userId],
      );
      return reply.send({
        success: true,
        data: res.rows,
        metadata: { timestamp: new Date().toISOString() },
      });
    } catch (err) {
      request.log.error(err, 'Failed to get notification history');
      return reply
        .status(500)
        .send({ success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to fetch history' } });
    }
  });
}
