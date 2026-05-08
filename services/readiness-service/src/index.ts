import { buildApp } from './app';
import { appConfig, validateConfig } from './config';
import { initDatabase, closeDatabase, createReadinessScoresTable } from './utils/database';
import { initRedis, closeRedis } from './utils/redis';
import { initKafkaProducer, closeKafkaProducer } from './utils/kafka';
import { startHealthIngestedConsumer, closeHealthIngestedConsumer } from './consumers/health-ingested.consumer';

const start = async () => {
  try {
    validateConfig();

    initDatabase();
    console.log('✅ Database connected');

    await createReadinessScoresTable();
    console.log('✅ readiness_scores table ready');

    initRedis();
    console.log('✅ Redis connected');

    await initKafkaProducer();
    console.log('✅ Kafka producer connected');

    await startHealthIngestedConsumer();
    console.log('✅ Kafka consumer started');

    const app = await buildApp();

    await app.listen({ port: appConfig.port, host: '0.0.0.0' });

    console.log(`🚀 Readiness Service running on port ${appConfig.port}`);
  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
};

const shutdown = async (signal: string) => {
  console.log(`\n${signal} received, shutting down gracefully...`);
  try {
    await closeHealthIngestedConsumer();
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
