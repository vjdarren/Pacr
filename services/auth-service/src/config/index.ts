import { readFileSync } from 'fs';
import path from 'path';
import dotenv from 'dotenv';

dotenv.config();

function required(key: string): string {
  const val = process.env[key];
  if (!val) throw new Error(`Missing required env var: ${key}`);
  return val;
}

function optional(key: string, fallback: string): string {
  return process.env[key] ?? fallback;
}

const secretsDir = path.join(__dirname, '..', '..', 'secrets');

export const config = {
  port: parseInt(optional('PORT', '3001'), 10),
  nodeEnv: optional('NODE_ENV', 'development'),

  databaseUrl: required('DATABASE_URL'),
  redisUrl: required('REDIS_URL'),

  jwt: {
    privateKey: readFileSync(path.join(secretsDir, 'private.pem'), 'utf8'),
    publicKey: readFileSync(path.join(secretsDir, 'public.pem'), 'utf8'),
    expiry: optional('JWT_EXPIRY', '15m'),
    algorithm: 'RS256' as const,
  },

  refreshToken: {
    expirySeconds: parseInt(optional('REFRESH_TOKEN_EXPIRY_SECONDS', '604800'), 10),
  },

  hms: {
    appId: optional('HMS_APP_ID', ''),
    tokenVerifyUrl: optional(
      'HMS_TOKEN_VERIFY_URL',
      'https://oauth-login.cloud.huawei.com/oauth2/v3/tokeninfo'
    ),
  },

  rateLimit: {
    maxFailures: parseInt(optional('RATE_LIMIT_MAX_FAILURES', '5'), 10),
    windowSeconds: parseInt(optional('RATE_LIMIT_WINDOW_SECONDS', '900'), 10),
    lockoutSeconds: parseInt(optional('RATE_LIMIT_LOCKOUT_SECONDS', '900'), 10),
  },
} as const;
