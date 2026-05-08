import { buildApp } from './app';
import { appConfig, validateConfig } from './config';
import { initDatabase, closeDatabase } from './utils/database';
import { initKafka, closeKafka } from './utils/kafka';

const start = async () => {
  try {
    // Validate configuration
    validateConfig();

    // Initialize database
    initDatabase();
    console.log('✅ Database connected');

    // Initialize Kafka
    await initKafka();
    console.log('✅ Kafka connected');

    // Build and start Fastify app
    const app = await buildApp();

    await app.listen({
      port: appConfig.port,
      host: '0.0.0.0',
    });

    console.log(`🚀 Health Ingestion Service running on port ${appConfig.port}`);
  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
};

// Graceful shutdown
const shutdown = async (signal: string) => {
  console.log(`\n${signal} received, shutting down gracefully...`);

  try {
    await closeKafka();
    console.log('✅ Kafka disconnected');

    await closeDatabase();
    console.log('✅ Database disconnected');

    process.exit(0);
  } catch (error) {
    console.error('Error during shutdown:', error);
    process.exit(1);
  }
};

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));

start();
