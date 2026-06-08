import { FastifyInstance, FastifyRequest } from 'fastify';
import { z } from 'zod';
import { verifyToken } from '../middleware/verify-token';
import { getUserById, updateUser, getRunnerProfile, upsertRunnerProfile } from '../utils/database';
import type { ApiSuccessResponse } from '../types';

const UpdateUserBody = z.object({
  display_name: z.string().min(1).max(100).optional(),
  locale: z.string().max(20).optional(),
  timezone: z.string().max(64).optional(),
});

const UpdateProfileBody = z.object({
  goal_type: z.enum(['5k', '10k', 'half_marathon', 'marathon', 'general_fitness']).optional(),
  target_race_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  experience_level: z.enum(['beginner', 'intermediate', 'advanced']).optional(),
  weekly_days: z.number().int().min(0).max(7).optional(),
  max_session_min: z.number().int().min(15).max(360).optional(),
  available_days: z.array(z.string()).optional(),
  height_cm: z.number().positive().optional(),
  weight_kg: z.number().positive().optional(),
});

export const usersRoutes = async (app: FastifyInstance): Promise<void> => {
  app.get(
    '/api/v1/users/me',
    { preHandler: verifyToken },
    async (request: FastifyRequest, reply) => {
      const userId = request.user!.sub;
      const user = await getUserById(userId);

      if (!user) {
        return reply.status(404).send({
          success: false,
          error: { code: 'USER_NOT_FOUND', message: 'User not found' },
          metadata: { timestamp: new Date().toISOString(), requestId: request.id },
        });
      }

      const response: ApiSuccessResponse<typeof user> = {
        success: true,
        data: user,
        metadata: { timestamp: new Date().toISOString(), requestId: request.id },
      };
      return reply.send(response);
    }
  );

  app.patch(
    '/api/v1/users/me',
    { preHandler: verifyToken },
    async (request: FastifyRequest, reply) => {
      const userId = request.user!.sub;
      const parsed = UpdateUserBody.safeParse(request.body);

      if (!parsed.success) {
        return reply.status(400).send({
          success: false,
          error: { code: 'INVALID_BODY', message: parsed.error.message },
          metadata: { timestamp: new Date().toISOString(), requestId: request.id },
        });
      }

      const user = await updateUser(userId, parsed.data);
      if (!user) {
        return reply.status(404).send({
          success: false,
          error: { code: 'USER_NOT_FOUND', message: 'User not found' },
          metadata: { timestamp: new Date().toISOString(), requestId: request.id },
        });
      }

      const response: ApiSuccessResponse<typeof user> = {
        success: true,
        data: user,
        metadata: { timestamp: new Date().toISOString(), requestId: request.id },
      };
      return reply.send(response);
    }
  );

  app.get(
    '/api/v1/users/me/profile',
    { preHandler: verifyToken },
    async (request: FastifyRequest, reply) => {
      const userId = request.user!.sub;
      const profile = await getRunnerProfile(userId);

      const response: ApiSuccessResponse<typeof profile> = {
        success: true,
        data: profile,
        metadata: { timestamp: new Date().toISOString(), requestId: request.id },
      };
      return reply.send(response);
    }
  );

  app.patch(
    '/api/v1/users/me/profile',
    { preHandler: verifyToken },
    async (request: FastifyRequest, reply) => {
      const userId = request.user!.sub;
      const parsed = UpdateProfileBody.safeParse(request.body);

      if (!parsed.success) {
        return reply.status(400).send({
          success: false,
          error: { code: 'INVALID_BODY', message: parsed.error.message },
          metadata: { timestamp: new Date().toISOString(), requestId: request.id },
        });
      }

      const profile = await upsertRunnerProfile(userId, parsed.data);

      const response: ApiSuccessResponse<typeof profile> = {
        success: true,
        data: profile,
        metadata: { timestamp: new Date().toISOString(), requestId: request.id },
      };
      return reply.send(response);
    }
  );
};
