import { getRedis, rateLimitKey, lockoutKey } from '../utils/redis';
import { config } from '../config';

export interface RateLimitResult {
  blocked: boolean;
  remainingAttempts: number;
}

export async function checkRateLimit(ip: string): Promise<RateLimitResult> {
  const redis = getRedis();

  const isLocked = await redis.exists(lockoutKey(ip));
  if (isLocked) {
    return { blocked: true, remainingAttempts: 0 };
  }

  const current = await redis.get(rateLimitKey(ip));
  const failures = current ? parseInt(current, 10) : 0;
  const remaining = Math.max(0, config.rateLimit.maxFailures - failures);

  return { blocked: false, remainingAttempts: remaining };
}

export async function recordFailure(ip: string): Promise<RateLimitResult> {
  const redis = getRedis();

  const isLocked = await redis.exists(lockoutKey(ip));
  if (isLocked) {
    return { blocked: true, remainingAttempts: 0 };
  }

  const pipeline = redis.pipeline();
  pipeline.incr(rateLimitKey(ip));
  pipeline.expire(rateLimitKey(ip), config.rateLimit.windowSeconds);
  const results = await pipeline.exec();

  const newCount = (results?.[0]?.[1] as number) ?? 1;

  if (newCount >= config.rateLimit.maxFailures) {
    // Trigger lockout
    await redis.set(lockoutKey(ip), '1', 'EX', config.rateLimit.lockoutSeconds);
    await redis.del(rateLimitKey(ip));
    return { blocked: true, remainingAttempts: 0 };
  }

  return {
    blocked: false,
    remainingAttempts: config.rateLimit.maxFailures - newCount,
  };
}

export async function clearRateLimit(ip: string): Promise<void> {
  const redis = getRedis();
  await redis.del(rateLimitKey(ip));
}
