import Redis from 'ioredis';
import { appConfig } from '../config';
import type { ActiveRunCache } from '../types';

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

const activeRunKey = (userId: string) => `run:active:${userId}`;

export const setActiveRun = async (userId: string, data: ActiveRunCache): Promise<void> => {
  await getRedis().setex(activeRunKey(userId), appConfig.activeRunTtlSeconds, JSON.stringify(data));
};

export const getActiveRun = async (userId: string): Promise<ActiveRunCache | null> => {
  const raw = await getRedis().get(activeRunKey(userId));
  if (!raw) return null;
  try {
    return JSON.parse(raw) as ActiveRunCache;
  } catch {
    return null;
  }
};

export const clearActiveRun = async (userId: string): Promise<void> => {
  await getRedis().del(activeRunKey(userId));
};
