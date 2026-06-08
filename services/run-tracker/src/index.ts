import { buildApp } from './app';
import { appConfig, validateConfig } from './config';
import { initDatabase, closeDatabase } from './utils/database';
import { initRedis, closeRedis } from './utils/redis';
import { initKafkaProducer, closeKafkaProducer } from './utils/kafka';

const start = async () => {
  try {
    validateConfig();

    initDatabase();
    console.log('✅ Database connected');

    initRedis();
    console.log('✅ Redis connected');

    await initKafkaProducer();
    console.log('✅ Kafka producer connected');

    const app = await buildApp();
    await app.listen({ port: appConfig.port, host: '0.0.0.0' });

    console.log(`🚀 Run Tracker running on port ${appConfig.port}`);
  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
};

const shutdown = async (signal: string) => {
  console.log(`\n${signal} received, shutting down gracefully...`);
  try {
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
