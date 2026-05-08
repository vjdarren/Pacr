import Fastify, { FastifyInstance } from 'fastify';
import cors from '@fastify/cors';
import { appConfig } from './config';
import { healthSyncRoutes } from './routes/health-sync.routes';

export const buildApp = async (): Promise<FastifyInstance> => {
  const app = Fastify({
    logger: {
      level: appConfig.logLevel,
      transport: appConfig.prettyLogs
        ? {
            target: 'pino-pretty',
            options: {
              colorize: true,
              translateTime: 'HH:MM:ss Z',
              ignore: 'pid,hostname',
            },
          }
        : undefined,
    },
  });

  // Register CORS
  await app.register(cors, {
    origin: true, // Allow all origins in development
    credentials: true,
  });

  // Register routes
  await app.register(healthSyncRoutes);

  // Root endpoint
  app.get('/', async () => {
    return {
      service: 'health-ingestion',
      version: '1.0.0',
      status: 'running',
    };
  });

  // Error handler
  app.setErrorHandler((error, request, reply) => {
    request.log.error(error);

    const statusCode = (error as any).statusCode || 500;
    const errorCode = (error as any).code || 'INTERNAL_ERROR';
    const errorMessage = (error as any).message || 'Internal server error';

    reply.status(statusCode).send({
      success: false,
      error: {
        code: errorCode,
        message: errorMessage,
      },
      metadata: {
        timestamp: new Date().toISOString(),
        requestId: request.id,
      },
    });
  });

  return app;
};
