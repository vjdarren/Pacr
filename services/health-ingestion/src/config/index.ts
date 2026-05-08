import { config } from 'dotenv';

config();

export const appConfig = {
  // Server
  port: parseInt(process.env.PORT || '3003', 10),
  nodeEnv: process.env.NODE_ENV || 'development',

  // Database
  databaseUrl: process.env.DATABASE_URL || 'postgresql://pacr:pacr_dev_password@localhost:5433/pacr_dev',

  // Kafka
  kafkaBrokers: (process.env.KAFKA_BROKERS || 'localhost:9093').split(','),
  kafkaClientId: process.env.KAFKA_CLIENT_ID || 'health-ingestion',

  // Batch processing
  maxBatchSize: parseInt(process.env.MAX_BATCH_SIZE || '100', 10),
  maxHistoricalBatchSize: parseInt(process.env.MAX_HISTORICAL_BATCH_SIZE || '15000', 10),
  historicalBatchChunkSize: parseInt(process.env.HISTORICAL_BATCH_CHUNK_SIZE || '500', 10),
  maxHistoricalDays: parseInt(process.env.MAX_HISTORICAL_DAYS || '30', 10),

  // Logging
  logLevel: process.env.LOG_LEVEL || 'info',
  prettyLogs: process.env.NODE_ENV === 'development',
};

export const validateConfig = () => {
  const required = ['DATABASE_URL'];
  const missing = required.filter((key) => !process.env[key]);

  if (missing.length > 0) {
    throw new Error(`Missing required environment variables: ${missing.join(', ')}`);
  }
};
