import Fastify, { FastifyInstance } from 'fastify';
import cors from '@fastify/cors';
import { appConfig } from './config';
import { readinessRoutes } from './routes/readiness.routes';

export const buildApp = async (): Promise<FastifyInstance> => {
  const app = Fastify({
    logger: {
      level: appConfig.logLevel,
      transport: appConfig.prettyLogs
        ? {
            target: 'pino-pretty',
            options: { colorize: true, translateTime: 'HH:MM:ss Z', ignore: 'pid,hostname' },
          }
        : undefined,
    },
  });

  await app.register(cors, { origin: true, credentials: true });

  await app.register(readinessRoutes);

  app.get('/health', async () => ({
    service: 'readiness-service',
    version: '1.0.0',
    status: 'running',
  }));

  app.setErrorHandler((error: Error & { statusCode?: number; code?: string }, request, reply) => {
    request.log.error(error);
    const statusCode = error.statusCode || 500;
    const errorCode = error.code || 'INTERNAL_ERROR';

    reply.status(statusCode).send({
      success: false,
      error: { code: errorCode, message: error.message || 'Internal server error' },
      metadata: { timestamp: new Date().toISOString(), requestId: request.id },
    });
  });

  return app;
};
