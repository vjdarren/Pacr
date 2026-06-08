import { buildApp } from './app';
import { appConfig, validateConfig } from './config';
import { initDatabase, closeDatabase, getPool } from './utils/database';
import { initRedis, closeRedis, getRedis } from './utils/redis';
import { getKafkaInstance } from './utils/kafka';
import { startRunCompletedConsumer } from './consumers/run-completed.consumer';

const start = async () => {
  try {
    validateConfig();

    initDatabase();
    console.log('Database connected');

    initRedis();
    console.log('Redis connected');

    const app = await buildApp();

    await app.listen({ port: appConfig.port, host: '0.0.0.0' });

    console.log(`Analytics Service running on port ${appConfig.port}`);

    const kafka = getKafkaInstance();
    await startRunCompletedConsumer(kafka, getPool(), getRedis());
    console.log('Kafka consumer started');
  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
};

const shutdown = async (signal: string) => {
  console.log(`\n${signal} received, shutting down gracefully...`);
  try {
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
