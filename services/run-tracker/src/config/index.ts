import { config } from 'dotenv';

config();

export const appConfig = {
  port: parseInt(process.env.PORT || '3007', 10),
  nodeEnv: process.env.NODE_ENV || 'development',

  databaseUrl:
    process.env.DATABASE_URL || 'postgresql://pacr:pacr_dev_password@localhost:5433/pacr_dev',

  redisUrl: process.env.REDIS_URL || 'redis://:pacr_redis_password@localhost:6379',

  kafkaBrokers: (process.env.KAFKA_BROKERS || 'localhost:9093').split(','),
  kafkaClientId: process.env.KAFKA_CLIENT_ID || 'run-tracker',

  activeRunTtlSeconds: 12 * 60 * 60, // 12 hours

  logLevel: process.env.LOG_LEVEL || 'info',
  prettyLogs: process.env.NODE_ENV === 'development',
};

export const validateConfig = () => {
  const missing: string[] = [];

  if (!process.env.DATABASE_URL) missing.push('DATABASE_URL');
  if (!process.env.REDIS_URL) missing.push('REDIS_URL');
  if (!process.env.JWT_PUBLIC_KEY && !process.env.JWT_PUBLIC_KEY_PATH) {
    missing.push('JWT_PUBLIC_KEY or JWT_PUBLIC_KEY_PATH');
  }

  if (missing.length > 0) {
    throw new Error(`Missing required environment variables: ${missing.join(', ')}`);
  }
};
