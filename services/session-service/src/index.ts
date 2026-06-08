import { buildApp } from './app';
import { appConfig, validateConfig } from './config';
import { initDatabase, closeDatabase, markSessionComplete, getSessionById } from './utils/database';
import { initRedis, closeRedis } from './utils/redis';
import {
  initKafkaProducer,
  closeKafkaProducer,
  startPlanGeneratedConsumer,
  closePlanGeneratedConsumer,
  startRunCompletedConsumer,
  closeRunCompletedConsumer,
} from './utils/kafka';

const start = async () => {
  try {
    validateConfig();

    initDatabase();
    console.log('✅ Database connected');

    initRedis();
    console.log('✅ Redis connected');

    await initKafkaProducer();
    console.log('✅ Kafka producer connected');

    await startPlanGeneratedConsumer();
    console.log('✅ plan.generated consumer started');

    await startRunCompletedConsumer(async (sessionId, runId) => {
      const session = await getSessionById(sessionId);
      if (!session) return;
      await markSessionComplete(sessionId, session.user_id, runId);
      console.log(`[session-service] Session ${sessionId} completed via run ${runId}`);
    });
    console.log('✅ run.completed consumer started');

    const app = await buildApp();
    await app.listen({ port: appConfig.port, host: '0.0.0.0' });

    console.log(`🚀 Session Service running on port ${appConfig.port}`);
  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
};

const shutdown = async (signal: string) => {
  console.log(`\n${signal} received, shutting down gracefully...`);
  try {
    await closeRunCompletedConsumer();
    await closePlanGeneratedConsumer();
    await closeKafkaProducer();
    await closeRedis();
    await closeDatabase();
    process.exit(0);
  } catch (error) {
    console.error('Error during shutdown:', error);
    process.exit(1);
  }
};

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));

start();
