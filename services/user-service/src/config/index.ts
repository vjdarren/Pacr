import { config } from 'dotenv';

config();

export const appConfig = {
  port: parseInt(process.env.PORT || '3002', 10),
  nodeEnv: process.env.NODE_ENV || 'development',

  databaseUrl:
    process.env.DATABASE_URL || 'postgresql://pacr:pacr_dev_password@localhost:5433/pacr_dev',

  jwtPublicKey: process.env.JWT_PUBLIC_KEY || '',
  jwtPublicKeyPath: process.env.JWT_PUBLIC_KEY_PATH || '',

  logLevel: process.env.LOG_LEVEL || 'info',
  prettyLogs: process.env.NODE_ENV === 'development',
};

export const validateConfig = () => {
  const missing: string[] = [];

  if (!process.env.DATABASE_URL) missing.push('DATABASE_URL');
  if (!process.env.JWT_PUBLIC_KEY && !process.env.JWT_PUBLIC_KEY_PATH) {
    missing.push('JWT_PUBLIC_KEY or JWT_PUBLIC_KEY_PATH');
  }

  if (missing.length > 0) {
    throw new Error(`Missing required environment variables: ${missing.join(', ')}`);
  }
};
