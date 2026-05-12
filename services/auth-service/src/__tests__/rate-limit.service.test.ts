/**
 * Unit tests for rate-limit.service.ts
 */
import { checkRateLimit, recordFailure, clearRateLimit } from '../services/rate-limit.service';

jest.mock('../config', () => ({
  config: {
    rateLimit: { maxFailures: 5, windowSeconds: 900, lockoutSeconds: 900 },
  },
}));

const mockExists = jest.fn();
const mockGet = jest.fn();
const mockDel = jest.fn();
const mockSet = jest.fn();
const mockPipeline = jest.fn();

jest.mock('../utils/redis', () => ({
  getRedis: () => ({
    exists: mockExists,
    get: mockGet,
    del: mockDel,
    set: mockSet,
    pipeline: mockPipeline,
  }),
  rateLimitKey: (ip: string) => `ratelimit:auth:${ip}`,
  lockoutKey: (ip: string) => `lockout:auth:${ip}`,
}));

const IP = '192.168.1.100';

beforeEach(() => {
  jest.clearAllMocks();
  mockPipeline.mockReturnValue({
    incr: jest.fn().mockReturnThis(),
    expire: jest.fn().mockReturnThis(),
    exec: jest.fn().mockResolvedValue([[null, 1]]),
  });
});

describe('checkRateLimit', () => {
  it('returns blocked=true when IP is locked out', async () => {
    mockExists.mockResolvedValueOnce(1);

    const result = await checkRateLimit(IP);
    expect(result.blocked).toBe(true);
    expect(result.remainingAttempts).toBe(0);
  });

  it('returns remaining attempts when under limit', async () => {
    mockExists.mockResolvedValueOnce(0);
    mockGet.mockResolvedValueOnce('2');

    const result = await checkRateLimit(IP);
    expect(result.blocked).toBe(false);
    expect(result.remainingAttempts).toBe(3);
  });

  it('returns 5 remaining when no failures recorded', async () => {
    mockExists.mockResolvedValueOnce(0);
    mockGet.mockResolvedValueOnce(null);

    const result = await checkRateLimit(IP);
    expect(result.remainingAttempts).toBe(5);
  });
});

describe('recordFailure', () => {
  it('returns blocked=true immediately when already locked out', async () => {
    mockExists.mockResolvedValueOnce(1);

    const result = await recordFailure(IP);
    expect(result.blocked).toBe(true);
  });

  it('increments failure count and returns remaining attempts', async () => {
    mockExists.mockResolvedValueOnce(0);
    mockPipeline.mockReturnValueOnce({
      incr: jest.fn().mockReturnThis(),
      expire: jest.fn().mockReturnThis(),
      exec: jest.fn().mockResolvedValue([[null, 2]]),
    });

    const result = await recordFailure(IP);
    expect(result.blocked).toBe(false);
    expect(result.remainingAttempts).toBe(3);
  });

  it('triggers lockout when failure count reaches max', async () => {
    mockExists.mockResolvedValueOnce(0);
    mockPipeline.mockReturnValueOnce({
      incr: jest.fn().mockReturnThis(),
      expire: jest.fn().mockReturnThis(),
      exec: jest.fn().mockResolvedValue([[null, 5]]),
    });
    mockSet.mockResolvedValueOnce('OK');
    mockDel.mockResolvedValueOnce(1);

    const result = await recordFailure(IP);
    expect(result.blocked).toBe(true);
    expect(result.remainingAttempts).toBe(0);
    expect(mockSet).toHaveBeenCalledWith(
      expect.stringContaining('lockout'),
      '1',
      'EX',
      900
    );
  });
});

describe('clearRateLimit', () => {
  it('deletes the rate limit key', async () => {
    mockDel.mockResolvedValueOnce(1);
    await clearRateLimit(IP);
    expect(mockDel).toHaveBeenCalledWith(`ratelimit:auth:${IP}`);
  });
});
