import { FastifyInstance, FastifyRequest } from 'fastify';
import { z } from 'zod';
import { verifyToken } from '../middleware/verify-token';
import {
  createRun,
  appendBatch,
  completeRun,
  getRunById,
  getRecentRuns,
} from '../utils/database';
import { setActiveRun, clearActiveRun } from '../utils/redis';
import { publishRunCompleted } from '../utils/kafka';
import type { ApiSuccessResponse } from '../types';

const UuidParam = z.object({ id: z.string().uuid() });

const StartRunBody = z.object({
  sessionId: z.string().uuid().optional(),
});

const LocationBatchBody = z.object({
  samples: z
    .array(
      z.object({
        lat: z.number().min(-90).max(90),
        lng: z.number().min(-180).max(180),
        altitudeM: z.number().optional(),
        hrBpm: z.number().int().min(30).max(250).optional(),
        paceSecKm: z.number().positive().optional(),
        timestamp: z.string(),
      })
    )
    .min(1)
    .max(100),
});

const CompleteRunBody = z.object({
  distanceKm: z.number().positive(),
  durationSec: z.number().int().positive(),
  avgPaceSecKm: z.number().positive(),
  avgHrBpm: z.number().int().min(30).max(250).optional(),
  maxHrBpm: z.number().int().min(30).max(250).optional(),
  elevationGainM: z.number().min(0).optional(),
});

export const runsRoutes = async (app: FastifyInstance): Promise<void> => {
  app.post(
    '/api/v1/runs/start',
    { preHandler: verifyToken },
    async (request: FastifyRequest, reply) => {
      const userId = request.user!.sub;

      const parsed = StartRunBody.safeParse(request.body ?? {});
      if (!parsed.success) {
        return reply.status(400).send({
          success: false,
          error: { code: 'INVALID_BODY', message: parsed.error.message },
          metadata: { timestamp: new Date().toISOString(), requestId: request.id },
        });
      }

      const run = await createRun(userId, parsed.data.sessionId);

      await setActiveRun(userId, {
        runId: run.id,
        startedAt: run.started_at.toISOString(),
        sessionId: parsed.data.sessionId ?? null,
      });

      const response: ApiSuccessResponse = {
        success: true,
        data: { runId: run.id, startedAt: run.started_at },
        metadata: { timestamp: new Date().toISOString(), requestId: request.id },
      };
      return reply.status(201).send(response);
    }
  );

  app.post(
    '/api/v1/runs/:id/location-batch',
    { preHandler: verifyToken },
    async (request: FastifyRequest, reply) => {
      const userId = request.user!.sub;

      const parsedParam = UuidParam.safeParse(request.params);
      if (!parsedParam.success) {
        return reply.status(400).send({
          success: false,
          error: { code: 'INVALID_RUN_ID', message: 'Run ID must be a valid UUID' },
          metadata: { timestamp: new Date().toISOString(), requestId: request.id },
        });
      }

      const parsedBody = LocationBatchBody.safeParse(request.body);
      if (!parsedBody.success) {
        return reply.status(400).send({
          success: false,
          error: { code: 'INVALID_BODY', message: parsedBody.error.message },
          metadata: { timestamp: new Date().toISOString(), requestId: request.id },
        });
      }

      await appendBatch(parsedParam.data.id, userId, parsedBody.data.samples);

      const response: ApiSuccessResponse = {
        success: true,
        data: { accepted: parsedBody.data.samples.length },
        metadata: { timestamp: new Date().toISOString(), requestId: request.id },
      };
      return reply.send(response);
    }
  );

  app.patch(
    '/api/v1/runs/:id/complete',
    { preHandler: verifyToken },
    async (request: FastifyRequest, reply) => {
      const userId = request.user!.sub;

      const parsedParam = UuidParam.safeParse(request.params);
      if (!parsedParam.success) {
        return reply.status(400).send({
          success: false,
          error: { code: 'INVALID_RUN_ID', message: 'Run ID must be a valid UUID' },
          metadata: { timestamp: new Date().toISOString(), requestId: request.id },
        });
      }

      const parsedBody = CompleteRunBody.safeParse(request.body);
      if (!parsedBody.success) {
        return reply.status(400).send({
          success: false,
          error: { code: 'INVALID_BODY', message: parsedBody.error.message },
          metadata: { timestamp: new Date().toISOString(), requestId: request.id },
        });
      }

      const run = await completeRun(parsedParam.data.id, userId, parsedBody.data);

      if (!run) {
        return reply.status(404).send({
          success: false,
          error: { code: 'RUN_NOT_FOUND', message: 'Run not found' },
          metadata: { timestamp: new Date().toISOString(), requestId: request.id },
        });
      }

      await clearActiveRun(userId);

      await publishRunCompleted(
        userId,
        run.id,
        run.session_id,
        parsedBody.data.distanceKm,
        parsedBody.data.durationSec,
        parsedBody.data.avgPaceSecKm
      );

      const response: ApiSuccessResponse = {
        success: true,
        data: run,
        metadata: { timestamp: new Date().toISOString(), requestId: request.id },
      };
      return reply.send(response);
    }
  );

  app.get(
    '/api/v1/runs/:id',
    { preHandler: verifyToken },
    async (request: FastifyRequest, reply) => {
      const userId = request.user!.sub;

      const parsedParam = UuidParam.safeParse(request.params);
      if (!parsedParam.success) {
        return reply.status(400).send({
          success: false,
          error: { code: 'INVALID_RUN_ID', message: 'Run ID must be a valid UUID' },
          metadata: { timestamp: new Date().toISOString(), requestId: request.id },
        });
      }

      const run = await getRunById(parsedParam.data.id, userId);

      if (!run) {
        return reply.status(404).send({
          success: false,
          error: { code: 'RUN_NOT_FOUND', message: 'Run not found' },
          metadata: { timestamp: new Date().toISOString(), requestId: request.id },
        });
      }

      const response: ApiSuccessResponse = {
        success: true,
        data: run,
        metadata: { timestamp: new Date().toISOString(), requestId: request.id },
      };
      return reply.send(response);
    }
  );

  app.get(
    '/api/v1/runs/recent',
    { preHandler: verifyToken },
    async (request: FastifyRequest, reply) => {
      const userId = request.user!.sub;
      const runs = await getRecentRuns(userId);

      const response: ApiSuccessResponse = {
        success: true,
        data: runs,
        metadata: { timestamp: new Date().toISOString(), requestId: request.id },
      };
      return reply.send(response);
    }
  );
};
