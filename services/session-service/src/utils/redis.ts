import Redis from 'ioredis';
import { appConfig } from '../config';
import type { ReadinessCache } from '../types';

let redis: Redis;

export const initRedis = (): Redis => {
  redis = new Redis(appConfig.redisUrl, {
    lazyConnect: false,
    retryStrategy: (times) => Math.min(times * 300, 3000),
    maxRetriesPerRequest: 3,
  });

  redis.on('error', (err) => {
    console.error('Redis client error:', err);
  });

  return redis;
};

export const getRedis = (): Redis => {
  if (!redis) return initRedis();
  return redis;
};

export const closeRedis = async (): Promise<void> => {
  if (redis) await redis.quit();
};

// Reads from the readiness-service's Redis cache key
export const getCachedReadiness = async (userId: string): Promise<ReadinessCache | null> => {
  const raw = await getRedis().get(`readiness:today:${userId}`);
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as { score: number; overtraining_flag?: boolean };
    return { score: parsed.score, overtraining_flag: parsed.overtraining_flag ?? false };
  } catch {
    return null;
  }
};
