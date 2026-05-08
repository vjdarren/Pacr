import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { randomUUID } from 'crypto';
import {
  HealthSyncBatchSchema,
  HistoricalSyncBatchSchema,
  ApiSuccessResponse,
  ApiErrorResponse,
} from '../types';
import {
  syncHealthMetrics,
  syncHistoricalMetrics,
  getUserSyncStatus,
  SyncResult,
} from '../services/health-sync.service';

export async function healthSyncRoutes(fastify: FastifyInstance) {
  /**
   * POST /api/v1/health/sync
   * Sync a batch of health metrics (up to 100 records)
   */
  fastify.post<{
    Body: unknown;
  }>('/api/v1/health/sync', async (request: FastifyRequest, reply: FastifyReply) => {
    const requestId = randomUUID();

    try {
      // Validate request body
      const parsed = HealthSyncBatchSchema.safeParse(request.body);

      if (!parsed.success) {
        const errorResponse: ApiErrorResponse = {
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: 'Invalid request body',
            details: parsed.error.format(),
          },
          metadata: {
            timestamp: new Date().toISOString(),
            requestId,
          },
        };
        return reply.code(400).send(errorResponse);
      }

      const { userId, metrics } = parsed.data;

      // Process the batch
      const result: SyncResult = await syncHealthMetrics(userId, metrics);

      const successResponse: ApiSuccessResponse<SyncResult> = {
        success: true,
        data: result,
        metadata: {
          timestamp: new Date().toISOString(),
          requestId,
        },
      };

      return reply.code(200).send(successResponse);
    } catch (error: any) {
      request.log.error(error);

      const errorResponse: ApiErrorResponse = {
        success: false,
        error: {
          code: 'INTERNAL_ERROR',
          message: 'Failed to process health metrics',
          details: error.message,
        },
        metadata: {
          timestamp: new Date().toISOString(),
          requestId,
        },
      };

      return reply.code(500).send(errorResponse);
    }
  });

  /**
   * POST /api/v1/health/sync/historical
   * Sync historical health metrics (up to 30 days, max 15,000 records)
   */
  fastify.post<{
    Body: unknown;
  }>('/api/v1/health/sync/historical', async (request: FastifyRequest, reply: FastifyReply) => {
    const requestId = randomUUID();

    try {
      // Validate request body
      const parsed = HistoricalSyncBatchSchema.safeParse(request.body);

      if (!parsed.success) {
        const errorResponse: ApiErrorResponse = {
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: 'Invalid request body',
            details: parsed.error.format(),
          },
          metadata: {
            timestamp: new Date().toISOString(),
            requestId,
          },
        };
        return reply.code(400).send(errorResponse);
      }

      const { userId, metrics } = parsed.data;

      // Process historical data in batches
      const result: SyncResult = await syncHistoricalMetrics(userId, metrics);

      const successResponse: ApiSuccessResponse<SyncResult> = {
        success: true,
        data: result,
        metadata: {
          timestamp: new Date().toISOString(),
          requestId,
        },
      };

      return reply.code(200).send(successResponse);
    } catch (error: any) {
      request.log.error(error);

      const errorResponse: ApiErrorResponse = {
        success: false,
        error: {
          code: error.message.includes('Invalid historical data')
            ? 'VALIDATION_ERROR'
            : 'INTERNAL_ERROR',
          message: error.message || 'Failed to process historical health metrics',
          details: error.message,
        },
        metadata: {
          timestamp: new Date().toISOString(),
          requestId,
        },
      };

      return reply.code(error.message.includes('Invalid historical data') ? 400 : 500).send(errorResponse);
    }
  });

  /**
   * GET /api/v1/health/sync/status/:userId
   * Get sync status for a user
   */
  fastify.get<{
    Params: { userId: string };
  }>('/api/v1/health/sync/status/:userId', async (request: FastifyRequest, reply: FastifyReply) => {
    const requestId = randomUUID();

    try {
      const { userId } = request.params as { userId: string };

      // Validate UUID format
      const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
      if (!uuidRegex.test(userId)) {
        const errorResponse: ApiErrorResponse = {
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: 'Invalid user ID format',
          },
          metadata: {
            timestamp: new Date().toISOString(),
            requestId,
          },
        };
        return reply.code(400).send(errorResponse);
      }

      const status = await getUserSyncStatus(userId);

      const successResponse: ApiSuccessResponse = {
        success: true,
        data: status,
        metadata: {
          timestamp: new Date().toISOString(),
          requestId,
        },
      };

      return reply.code(200).send(successResponse);
    } catch (error: any) {
      request.log.error(error);

      const errorResponse: ApiErrorResponse = {
        success: false,
        error: {
          code: 'INTERNAL_ERROR',
          message: 'Failed to fetch sync status',
          details: error.message,
        },
        metadata: {
          timestamp: new Date().toISOString(),
          requestId,
        },
      };

      return reply.code(500).send(errorResponse);
    }
  });

  /**
   * Health check endpoint
   */
  fastify.get('/health', async (_request: FastifyRequest, reply: FastifyReply) => {
    return reply.code(200).send({
      status: 'healthy',
      service: 'health-ingestion',
      timestamp: new Date().toISOString(),
    });
  });
}
