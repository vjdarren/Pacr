import { AnalyticsService } from '../src/services/analytics.service';

const mockDb = { query: jest.fn() } as any;
const mockRedis = { get: jest.fn(), setex: jest.fn(), del: jest.fn() } as any;

describe('AnalyticsService', () => {
  beforeEach(() => jest.clearAllMocks());

  describe('getProgress', () => {
    it('returns cached result when available', async () => {
      const cached = { userId: 'u1', weeklyDistanceKm: 30 };
      mockRedis.get.mockResolvedValue(JSON.stringify(cached));
      const svc = new AnalyticsService(mockDb, mockRedis);
      const result = await svc.getProgress('u1');
      expect(result).toEqual(cached);
      expect(mockDb.query).not.toHaveBeenCalled();
    });

    it('queries db and caches result on cache miss', async () => {
      mockRedis.get.mockResolvedValue(null);
      mockDb.query
        .mockResolvedValueOnce({ rows: [{ km: '42.5' }] })
        .mockResolvedValueOnce({ rows: [{ streak_days: '5' }] })
        .mockResolvedValueOnce({ rows: [{ total: '100' }] })
        .mockResolvedValueOnce({ rows: [{ completed: '3' }] })
        .mockResolvedValueOnce({ rows: [{ target: '4' }] });

      const svc = new AnalyticsService(mockDb, mockRedis);
      const result = await svc.getProgress('u1');
      expect(result.weeklyDistanceKm).toBe(42.5);
      expect(result.currentStreakDays).toBe(5);
      expect(mockRedis.setex).toHaveBeenCalledWith(
        'analytics:progress:u1',
        3600,
        expect.any(String),
      );
    });
  });

  describe('getRacePredictor', () => {
    it('uses VDOT 40 default when no VO2Max reading exists', async () => {
      mockRedis.get.mockResolvedValue(null);
      mockDb.query.mockResolvedValue({ rows: [] });
      const svc = new AnalyticsService(mockDb, mockRedis);
      const result = await svc.getRacePredictor('u1');
      expect(result.currentVdot).toBe(40);
      expect(result.predictions).toHaveLength(4);
    });

    it('clamps VDOT to 30-85 range', async () => {
      mockRedis.get.mockResolvedValue(null);
      mockDb.query.mockResolvedValue({ rows: [{ value: '150' }] });
      const svc = new AnalyticsService(mockDb, mockRedis);
      const result = await svc.getRacePredictor('u1');
      expect(result.currentVdot).toBe(85);
    });
  });
});
