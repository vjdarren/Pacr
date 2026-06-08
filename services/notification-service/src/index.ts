import { buildApp } from './app';
import { appConfig, validateConfig } from './config';
import { initDatabase, closeDatabase, getPool } from './utils/database';
import { getKafkaInstance } from './utils/kafka';
import { startEventsConsumer } from './consumers/events.consumer';
import { initFcm } from './providers/fcm.provider';

const start = async () => {
  try {
    validateConfig();

    initDatabase();
    console.log('Database connected');

    initFcm();
    console.log('FCM initialised');

    const app = await buildApp();

    await app.listen({ port: appConfig.port, host: '0.0.0.0' });

    console.log(`Notification Service running on port ${appConfig.port}`);

    const kafka = getKafkaInstance();
    await startEventsConsumer(kafka, getPool());
    console.log('Kafka consumer started');
  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
};

const shutdown = async (signal: string) => {
  console.log(`\n${signal} received, shutting down gracefully...`);
  try {
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
