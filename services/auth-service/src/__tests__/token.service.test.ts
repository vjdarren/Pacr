/**
 * Unit tests for token.service.ts
 */

jest.mock('../config', () => ({
  config: {
    jwt: {
      privateKey: 'MOCK_PRIVATE',
      publicKey: 'MOCK_PUBLIC',
      expiry: '15m',
      algorithm: 'RS256',
    },
    refreshToken: { expirySeconds: 604800 },
  },
}));

const mockPipelineExec = jest.fn().mockResolvedValue([]);
const mockPipeline = jest.fn(() => ({
  set: jest.fn().mockReturnThis(),
  sadd: jest.fn().mockReturnThis(),
  expire: jest.fn().mockReturnThis(),
  del: jest.fn().mockReturnThis(),
  exec: mockPipelineExec,
}));
const mockGet = jest.fn();
const mockDel = jest.fn();
const mockSrem = jest.fn();
const mockSmembers = jest.fn().mockResolvedValue([]);

jest.mock('../utils/redis', () => ({
  getRedis: () => ({
    pipeline: mockPipeline,
    get: mockGet,
    del: mockDel,
    srem: mockSrem,
    smembers: mockSmembers,
  }),
  refreshKey: (t: string) => `refresh:${t}`,
  familyKey: (u: string, f: string) => `family:${u}:${f}`,
}));

jest.mock('jsonwebtoken', () => ({
  sign: jest.fn().mockReturnValue('signed.access.token'),
  verify: jest.fn().mockReturnValue({ sub: 'user-123', email: 'a@b.com' }),
}));

import {
  signAccessToken,
  verifyAccessToken,
  issueTokenPair,
  rotateRefreshToken,
  invalidateRefreshToken,
  invalidateFamily,
} from '../services/token.service';
import jwt from 'jsonwebtoken';

const USER_ID = '550e8400-e29b-41d4-a716-446655440000';
const EMAIL = 'test@pacr.app';

beforeEach(() => jest.clearAllMocks());

describe('signAccessToken', () => {
  it('calls jwt.sign with RS256', () => {
    const token = signAccessToken({ sub: USER_ID, email: EMAIL });
    expect(jwt.sign).toHaveBeenCalledWith(
      { sub: USER_ID, email: EMAIL },
      'MOCK_PRIVATE',
      expect.objectContaining({ algorithm: 'RS256' })
    );
    expect(token).toBe('signed.access.token');
  });
});

describe('verifyAccessToken', () => {
  it('delegates to jwt.verify with public key', () => {
    const payload = verifyAccessToken('some.token');
    expect(jwt.verify).toHaveBeenCalledWith('some.token', 'MOCK_PUBLIC', expect.any(Object));
    expect(payload.sub).toBe('user-123');
  });
});

describe('issueTokenPair', () => {
  it('returns access and refresh tokens', async () => {
    const pair = await issueTokenPair(USER_ID, EMAIL);
    expect(pair.accessToken).toBe('signed.access.token');
    expect(pair.refreshToken).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
    );
  });

  it('stores the refresh token in Redis pipeline', async () => {
    await issueTokenPair(USER_ID, EMAIL);
    expect(mockPipeline).toHaveBeenCalled();
    expect(mockPipelineExec).toHaveBeenCalled();
  });

  it('uses provided familyId when given', async () => {
    const familyId = 'ffffffff-ffff-ffff-ffff-ffffffffffff';
    const mockPipelineInner = {
      set: jest.fn().mockReturnThis(),
      sadd: jest.fn().mockReturnThis(),
      expire: jest.fn().mockReturnThis(),
      del: jest.fn().mockReturnThis(),
      exec: jest.fn().mockResolvedValue([]),
    };
    mockPipeline.mockReturnValueOnce(mockPipelineInner);

    await issueTokenPair(USER_ID, EMAIL, familyId);
    // sadd should be called with family key containing the provided familyId
    expect(mockPipelineInner.sadd).toHaveBeenCalledWith(
      `family:${USER_ID}:${familyId}`,
      expect.any(String)
    );
  });
});

describe('rotateRefreshToken', () => {
  const OLD_TOKEN = 'old-token-uuid';
  const FAMILY_ID = 'family-uuid';

  it('returns new tokens and record on valid token', async () => {
    const record = { userId: USER_ID, familyId: FAMILY_ID, createdAt: Date.now() };
    mockGet.mockResolvedValueOnce(JSON.stringify(record));
    mockDel.mockResolvedValueOnce(1);

    const result = await rotateRefreshToken(OLD_TOKEN);
    expect(result).not.toBeNull();
    expect(result!.tokens).toHaveProperty('accessToken');
    expect(result!.record.userId).toBe(USER_ID);
  });

  it('returns null for unknown token', async () => {
    mockGet.mockResolvedValueOnce(null);
    const result = await rotateRefreshToken('ghost-token');
    expect(result).toBeNull();
  });

  it('returns null and invalidates family on reuse (DEL returns 0)', async () => {
    const record = { userId: USER_ID, familyId: FAMILY_ID, createdAt: Date.now() };
    mockGet.mockResolvedValueOnce(JSON.stringify(record));
    mockDel.mockResolvedValueOnce(0); // already deleted → reuse
    mockSmembers.mockResolvedValueOnce(['token-a', 'token-b']);

    const result = await rotateRefreshToken(OLD_TOKEN);
    expect(result).toBeNull();
    // Family should have been cleared
    expect(mockPipeline).toHaveBeenCalled();
  });
});

describe('invalidateRefreshToken', () => {
  it('removes token from Redis and family set', async () => {
    const record = { userId: USER_ID, familyId: 'fam', createdAt: Date.now() };
    mockGet.mockResolvedValueOnce(JSON.stringify(record));
    mockDel.mockResolvedValueOnce(1);
    mockSrem.mockResolvedValueOnce(1);

    await invalidateRefreshToken('my-token');
    expect(mockDel).toHaveBeenCalledWith('refresh:my-token');
  });

  it('is a no-op if token not in Redis', async () => {
    mockGet.mockResolvedValueOnce(null);
    await invalidateRefreshToken('ghost');
    expect(mockDel).not.toHaveBeenCalled();
  });
});

describe('invalidateFamily', () => {
  it('deletes all tokens in the family', async () => {
    const members = ['tok1', 'tok2'];
    mockSmembers.mockResolvedValueOnce(members);

    const mockFamilyPipeline = {
      set: jest.fn().mockReturnThis(),
      sadd: jest.fn().mockReturnThis(),
      expire: jest.fn().mockReturnThis(),
      del: jest.fn().mockReturnThis(),
      exec: jest.fn().mockResolvedValue([]),
    };
    mockPipeline.mockReturnValueOnce(mockFamilyPipeline);

    await invalidateFamily(USER_ID, 'fam-id');

    expect(mockFamilyPipeline.del).toHaveBeenCalledTimes(3); // 2 tokens + 1 family key
    expect(mockFamilyPipeline.exec).toHaveBeenCalled();
  });

  it('is a no-op if family has no members', async () => {
    mockSmembers.mockResolvedValueOnce([]);
    await invalidateFamily(USER_ID, 'empty-fam');
    expect(mockPipeline).not.toHaveBeenCalled();
  });
});
