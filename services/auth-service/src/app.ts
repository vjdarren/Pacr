import Fastify from 'fastify';
import cors from '@fastify/cors';
import { authRoutes } from './routes/auth.routes';

export function buildApp() {
  const app = Fastify({ logger: { level: 'info' } });

  app.register(cors, { origin: true });
  app.register(authRoutes);

  app.get('/health', async () => ({ status: 'ok', service: 'auth-service' }));

  app.setErrorHandler(
    (error: Error & { statusCode?: number; code?: string }, _request, reply) => {
      const status = error.statusCode ?? 500;
      reply.status(status).send({
        success: false,
        error: {
          code: error.code ?? 'INTERNAL_ERROR',
          message: error.message,
        },
      });
    }
  );

  return app;
}
