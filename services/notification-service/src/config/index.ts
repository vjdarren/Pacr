import { config } from 'dotenv';

config();

export const appConfig = {
  port: parseInt(process.env.PORT ?? '3010', 10),
  databaseUrl:
    process.env.DATABASE_URL ?? 'postgresql://pacr:pacr_dev_password@localhost:5433/pacr_dev',
  kafkaBrokers: (process.env.KAFKA_BROKERS ?? 'localhost:9093').split(','),
  kafkaClientId: process.env.KAFKA_CLIENT_ID ?? 'notification-service',
  jwtSecret: process.env.JWT_SECRET ?? '',
  jwtPublicKey: process.env.JWT_PUBLIC_KEY ?? '',
  jwtPublicKeyPath: process.env.JWT_PUBLIC_KEY_PATH ?? '',
  fcmServerKey: process.env.FCM_SERVER_KEY ?? '',
  logLevel: process.env.LOG_LEVEL ?? 'info',
  prettyLogs: process.env.NODE_ENV === 'development',
};

export const validateConfig = (): void => {
  const missing: string[] = [];

  if (!process.env.DATABASE_URL) missing.push('DATABASE_URL');
  if (!process.env.JWT_PUBLIC_KEY && !process.env.JWT_PUBLIC_KEY_PATH) {
    missing.push('JWT_PUBLIC_KEY or JWT_PUBLIC_KEY_PATH');
  }

  if (missing.length > 0) {
    throw new Error(`Missing required environment variables: ${missing.join(', ')}`);
  }
};
