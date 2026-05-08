import { config } from 'dotenv';

config();

export const appConfig = {
  port: parseInt(process.env.PORT || '3004', 10),
  nodeEnv: process.env.NODE_ENV || 'development',

  databaseUrl:
    process.env.DATABASE_URL || 'postgresql://pacr:pacr_dev_password@localhost:5433/pacr_dev',

  redisUrl: process.env.REDIS_URL || 'redis://:pacr_redis_password@localhost:6379',

  kafkaBrokers: (process.env.KAFKA_BROKERS || 'localhost:9093').split(','),
  kafkaClientId: process.env.KAFKA_CLIENT_ID || 'readiness-service',
  kafkaGroupId: process.env.KAFKA_GROUP_ID || 'readiness-service-group',

  redisCacheTtlSeconds: 6 * 60 * 60, // 6 hours

  logLevel: process.env.LOG_LEVEL || 'info',
  prettyLogs: process.env.NODE_ENV === 'development',
};

export const validateConfig = () => {
  const required = ['DATABASE_URL', 'REDIS_URL'];
  const missing = required.filter((key) => !process.env[key]);

  if (missing.length > 0) {
    throw new Error(`Missing required environment variables: ${missing.join(', ')}`);
  }
};
