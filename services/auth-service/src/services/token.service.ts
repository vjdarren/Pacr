import jwt, { type Algorithm } from 'jsonwebtoken';
import { v4 as uuidv4 } from 'uuid';
import { config } from '../config';
import { getRedis, refreshKey, familyKey } from '../utils/redis';
import type { JwtPayload, RefreshTokenRecord, TokenPair } from '../types';

export function signAccessToken(payload: Omit<JwtPayload, 'iat' | 'exp'>): string {
  return jwt.sign(payload as object, config.jwt.privateKey, {
    algorithm: config.jwt.algorithm as Algorithm,
    expiresIn: config.jwt.expiry as jwt.SignOptions['expiresIn'],
  });
}

export function verifyAccessToken(token: string): JwtPayload {
  return jwt.verify(token, config.jwt.publicKey, {
    algorithms: [config.jwt.algorithm as Algorithm],
  }) as JwtPayload;
}

export async function issueTokenPair(
  userId: string,
  email: string,
  familyId?: string
): Promise<TokenPair> {
  const redis = getRedis();
  const accessToken = signAccessToken({ sub: userId, email });
  const refreshToken = uuidv4();
  const resolvedFamily = familyId ?? uuidv4();

  const record: RefreshTokenRecord = {
    userId,
    familyId: resolvedFamily,
    createdAt: Date.now(),
  };

  const ttl = config.refreshToken.expirySeconds;

  const pipeline = redis.pipeline();
  pipeline.set(refreshKey(refreshToken), JSON.stringify(record), 'EX', ttl);
  // Track tokens in family for reuse-detection invalidation
  pipeline.sadd(familyKey(userId, resolvedFamily), refreshToken);
  pipeline.expire(familyKey(userId, resolvedFamily), ttl);
  await pipeline.exec();

  return { accessToken, refreshToken };
}

export async function rotateRefreshToken(
  incomingToken: string
): Promise<{ tokens: TokenPair; record: RefreshTokenRecord } | null> {
  const redis = getRedis();
  const raw = await redis.get(refreshKey(incomingToken));
  if (!raw) return null;

  const record: RefreshTokenRecord = JSON.parse(raw);

  // Delete the used token — if it was already deleted, this is a reuse
  const deleted = await redis.del(refreshKey(incomingToken));
  if (deleted === 0) {
    // Token already consumed — reuse detected; invalidate entire family
    await invalidateFamily(record.userId, record.familyId);
    return null;
  }

  // Remove the old token from family set
  await redis.srem(familyKey(record.userId, record.familyId), incomingToken);

  const tokens = await issueTokenPair(record.userId, '', record.familyId);
  // We don't store email in the record; caller must re-attach email from DB if needed
  return { tokens, record };
}

export async function invalidateRefreshToken(token: string): Promise<void> {
  const redis = getRedis();
  const raw = await redis.get(refreshKey(token));
  if (!raw) return;
  const record: RefreshTokenRecord = JSON.parse(raw);
  await redis.del(refreshKey(token));
  await redis.srem(familyKey(record.userId, record.familyId), token);
}

export async function invalidateFamily(userId: string, familyId: string): Promise<void> {
  const redis = getRedis();
  const key = familyKey(userId, familyId);
  const members = await redis.smembers(key);
  if (members.length > 0) {
    const pipeline = redis.pipeline();
    for (const token of members) {
      pipeline.del(refreshKey(token));
    }
    pipeline.del(key);
    await pipeline.exec();
  }
}
