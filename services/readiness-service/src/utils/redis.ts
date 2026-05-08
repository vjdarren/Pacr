import Redis from 'ioredis';
import { appConfig } from '../config';

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
  if (!redis) {
    return initRedis();
  }
  return redis;
};

export const closeRedis = async (): Promise<void> => {
  if (redis) {
    await redis.quit();
  }
};

const cacheKey = (userId: string) => `readiness:today:${userId}`;

export const getCachedReadiness = async (userId: string): Promise<string | null> => {
  return getRedis().get(cacheKey(userId));
};

export const setCachedReadiness = async (userId: string, data: unknown): Promise<void> => {
  await getRedis().setex(cacheKey(userId), appConfig.redisCacheTtlSeconds, JSON.stringify(data));
};

export const invalidateReadinessCache = async (userId: string): Promise<void> => {
  await getRedis().del(cacheKey(userId));
};
