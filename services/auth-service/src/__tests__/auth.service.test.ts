/**
 * Unit tests for auth.service.ts
 * All external dependencies (DB, Redis, fetch) are mocked.
 */
import { AuthError, register, login, refresh, logout, hmsLogin } from '../services/auth.service';
import bcrypt from 'bcrypt';

// ── Mock the database pool ────────────────────────────────────────────────────

const mockQuery = jest.fn();
jest.mock('../utils/database', () => ({
  getPool: () => ({ query: mockQuery }),
  initDatabase: jest.fn(),
  closePool: jest.fn(),
}));

// ── Mock Redis ─────────────────────────────────────────────────────────────────

const mockRedisGet = jest.fn();
const mockRedisDel = jest.fn();
const mockRedisSrem = jest.fn();
const mockRedisPipeline = jest.fn(() => ({
  set: jest.fn().mockReturnThis(),
  sadd: jest.fn().mockReturnThis(),
  expire: jest.fn().mockReturnThis(),
  del: jest.fn().mockReturnThis(),
  exec: jest.fn().mockResolvedValue([]),
}));

jest.mock('../utils/redis', () => ({
  getRedis: () => ({
    get: mockRedisGet,
    del: mockRedisDel,
    srem: mockRedisSrem,
    smembers: jest.fn().mockResolvedValue([]),
    pipeline: mockRedisPipeline,
  }),
  refreshKey: (t: string) => `refresh:${t}`,
  familyKey: (u: string, f: string) => `family:${u}:${f}`,
  rateLimitKey: (ip: string) => `ratelimit:auth:${ip}`,
  lockoutKey: (ip: string) => `lockout:auth:${ip}`,
}));

// ── Mock config so we don't need real PEM files during tests ──────────────────

jest.mock('../config', () => ({
  config: {
    jwt: {
      privateKey: 'MOCK_PRIVATE',
      publicKey: 'MOCK_PUBLIC',
      expiry: '15m',
      algorithm: 'RS256',
    },
    refreshToken: { expirySeconds: 604800 },
    hms: {
      appId: 'test-app-id',
      tokenVerifyUrl: 'https://mock-hms.test/tokeninfo',
    },
    rateLimit: { maxFailures: 5, windowSeconds: 900, lockoutSeconds: 900 },
  },
}));

// ── Mock jsonwebtoken so tests don't need real RSA keys ───────────────────────

jest.mock('jsonwebtoken', () => ({
  sign: jest.fn().mockReturnValue('mock.access.token'),
  verify: jest.fn().mockReturnValue({ sub: 'user-id', email: 'a@b.com' }),
}));

const TEST_USER_ID = '550e8400-e29b-41d4-a716-446655440000';
const TEST_EMAIL = 'test@pacr.app';
const TEST_PASSWORD = 'SecurePassword1!';

beforeEach(() => {
  jest.clearAllMocks();
  mockRedisPipeline.mockReturnValue({
    set: jest.fn().mockReturnThis(),
    sadd: jest.fn().mockReturnThis(),
    expire: jest.fn().mockReturnThis(),
    del: jest.fn().mockReturnThis(),
    exec: jest.fn().mockResolvedValue([]),
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// Registration
// ═══════════════════════════════════════════════════════════════════════════════

describe('register', () => {
  it('creates user and returns token pair on success', async () => {
    mockQuery
      .mockResolvedValueOnce({ rows: [] })                         // no existing user
      .mockResolvedValueOnce({ rows: [{ id: TEST_USER_ID }] });    // INSERT returning id

    const tokens = await register(TEST_EMAIL, TEST_PASSWORD);

    expect(tokens).toHaveProperty('accessToken');
    expect(tokens).toHaveProperty('refreshToken');
    expect(mockQuery).toHaveBeenCalledTimes(2);
  });

  it('throws EMAIL_TAKEN (409) when email already exists', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [{ id: TEST_USER_ID }] }); // existing user found

    await expect(register(TEST_EMAIL, TEST_PASSWORD)).rejects.toMatchObject({
      code: 'EMAIL_TAKEN',
      statusCode: 409,
    });
  });

  it('normalises email to lowercase', async () => {
    mockQuery
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [{ id: TEST_USER_ID }] });

    await register('TEST@PACR.APP', TEST_PASSWORD);

    expect(mockQuery.mock.calls[0][1]).toContain('test@pacr.app');
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// Login
// ═══════════════════════════════════════════════════════════════════════════════

describe('login', () => {
  async function makeHash(pw: string) {
    return bcrypt.hash(pw, 1); // 1 round for test speed
  }

  it('returns token pair for correct credentials', async () => {
    const hash = await makeHash(TEST_PASSWORD);
    mockQuery.mockResolvedValueOnce({
      rows: [{ id: TEST_USER_ID, email: TEST_EMAIL, password_hash: hash }],
    });

    const tokens = await login(TEST_EMAIL, TEST_PASSWORD);
    expect(tokens).toHaveProperty('accessToken');
    expect(tokens).toHaveProperty('refreshToken');
  });

  it('throws INVALID_CREDENTIALS (401) for wrong password', async () => {
    const hash = await makeHash(TEST_PASSWORD);
    mockQuery.mockResolvedValueOnce({
      rows: [{ id: TEST_USER_ID, email: TEST_EMAIL, password_hash: hash }],
    });

    await expect(login(TEST_EMAIL, 'WrongPassword!')).rejects.toMatchObject({
      code: 'INVALID_CREDENTIALS',
      statusCode: 401,
    });
  });

  it('throws INVALID_CREDENTIALS (401) for unknown email', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [] }); // user not found

    await expect(login('nobody@test.com', TEST_PASSWORD)).rejects.toMatchObject({
      code: 'INVALID_CREDENTIALS',
      statusCode: 401,
    });
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// Token Refresh
// ═══════════════════════════════════════════════════════════════════════════════

describe('refresh', () => {
  const REFRESH_TOKEN = '11111111-1111-1111-1111-111111111111';
  const FAMILY_ID = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';

  it('returns new token pair for valid refresh token', async () => {
    const record = JSON.stringify({
      userId: TEST_USER_ID,
      familyId: FAMILY_ID,
      createdAt: Date.now(),
    });
    mockRedisGet.mockResolvedValueOnce(record); // token exists
    mockRedisDel.mockResolvedValueOnce(1);       // successfully deleted (not reused)
    mockQuery.mockResolvedValueOnce({ rows: [{ email: TEST_EMAIL }] }); // DB email lookup

    const tokens = await refresh(REFRESH_TOKEN);
    expect(tokens).toHaveProperty('accessToken');
    expect(tokens).toHaveProperty('refreshToken');
  });

  it('throws INVALID_REFRESH_TOKEN (401) for unknown token', async () => {
    mockRedisGet.mockResolvedValueOnce(null); // token not in Redis

    await expect(refresh(REFRESH_TOKEN)).rejects.toMatchObject({
      code: 'INVALID_REFRESH_TOKEN',
      statusCode: 401,
    });
  });

  it('throws INVALID_REFRESH_TOKEN and invalidates family on token reuse', async () => {
    const record = JSON.stringify({
      userId: TEST_USER_ID,
      familyId: FAMILY_ID,
      createdAt: Date.now(),
    });
    // First GET returns the record (token appears to exist)
    mockRedisGet.mockResolvedValueOnce(record);
    // DEL returns 0 → token was already consumed → REUSE DETECTED
    mockRedisDel.mockResolvedValueOnce(0);

    // smembers for family key (called inside invalidateFamily)
    const { getRedis } = require('../utils/redis');
    getRedis().smembers = jest.fn().mockResolvedValueOnce([REFRESH_TOKEN, 'other-token']);

    await expect(refresh(REFRESH_TOKEN)).rejects.toMatchObject({
      code: 'INVALID_REFRESH_TOKEN',
      statusCode: 401,
    });
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// Logout
// ═══════════════════════════════════════════════════════════════════════════════

describe('logout', () => {
  it('removes the refresh token from Redis', async () => {
    const record = JSON.stringify({
      userId: TEST_USER_ID,
      familyId: 'fam-id',
      createdAt: Date.now(),
    });
    mockRedisGet.mockResolvedValueOnce(record);
    mockRedisDel.mockResolvedValueOnce(1);
    mockRedisSrem.mockResolvedValueOnce(1);

    await expect(logout('some-refresh-token')).resolves.toBeUndefined();
    expect(mockRedisDel).toHaveBeenCalledWith('refresh:some-refresh-token');
  });

  it('is a no-op if token does not exist', async () => {
    mockRedisGet.mockResolvedValueOnce(null);
    await expect(logout('ghost-token')).resolves.toBeUndefined();
    expect(mockRedisDel).not.toHaveBeenCalled();
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// HMS SSO
// ═══════════════════════════════════════════════════════════════════════════════

describe('hmsLogin', () => {
  beforeEach(() => {
    global.fetch = jest.fn();
  });

  it('returns token pair when HMS verification succeeds', async () => {
    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      json: async () => ({ sub: 'hms-open-id-123', email: 'hms@user.com' }),
    });

    mockQuery.mockResolvedValueOnce({
      rows: [{ id: TEST_USER_ID, email: 'hms@user.com' }],
    });

    const tokens = await hmsLogin('valid-hms-access-token');
    expect(tokens).toHaveProperty('accessToken');
    expect(tokens).toHaveProperty('refreshToken');
  });

  it('uses generated email when HMS response has no email field', async () => {
    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      json: async () => ({ sub: 'hms-open-id-456' }),
    });

    mockQuery.mockResolvedValueOnce({
      rows: [{ id: TEST_USER_ID, email: 'hms_hms-open-id-456@pacr.app' }],
    });

    await hmsLogin('valid-hms-token-no-email');
    expect(mockQuery.mock.calls[0][1][1]).toMatch(/^hms_/);
  });

  it('throws HMS_INVALID_TOKEN (401) when HMS returns non-ok', async () => {
    (global.fetch as jest.Mock).mockResolvedValueOnce({ ok: false });

    await expect(hmsLogin('bad-hms-token')).rejects.toMatchObject({
      code: 'HMS_INVALID_TOKEN',
      statusCode: 401,
    });
  });

  it('throws HMS_INVALID_RESPONSE (401) when sub is missing', async () => {
    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      json: async () => ({ email: 'no-sub@test.com' }),
    });

    await expect(hmsLogin('missing-sub-token')).rejects.toMatchObject({
      code: 'HMS_INVALID_RESPONSE',
      statusCode: 401,
    });
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// AuthError
// ═══════════════════════════════════════════════════════════════════════════════

describe('AuthError', () => {
  it('carries code and statusCode', () => {
    const err = new AuthError('test message', 'TEST_CODE', 403);
    expect(err.code).toBe('TEST_CODE');
    expect(err.statusCode).toBe(403);
    expect(err.message).toBe('test message');
    expect(err.name).toBe('AuthError');
  });

  it('defaults statusCode to 400', () => {
    const err = new AuthError('msg', 'CODE');
    expect(err.statusCode).toBe(400);
  });
});
