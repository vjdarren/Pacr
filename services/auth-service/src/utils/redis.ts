import Redis from 'ioredis';
import { config } from '../config';

let client: Redis | null = null;

export function getRedis(): Redis {
  if (!client) {
    client = new Redis(config.redisUrl, { lazyConnect: true });
  }
  return client;
}

export async function closeRedis(): Promise<void> {
  if (client) {
    await client.quit();
    client = null;
  }
}

// Refresh token key: refresh:{token} → JSON RefreshTokenRecord
export const refreshKey = (token: string) => `refresh:${token}`;

// Family key: family:{userId}:{familyId} → SET of token IDs in this family
export const familyKey = (userId: string, familyId: string) =>
  `family:${userId}:${familyId}`;

// Rate limit key: ratelimit:auth:{ip}
export const rateLimitKey = (ip: string) => `ratelimit:auth:${ip}`;

// Lockout key: lockout:auth:{ip}
export const lockoutKey = (ip: string) => `lockout:auth:${ip}`;
