import { Pool } from 'pg';
import Redis from 'ioredis';
import { ProgressSummary, TrendData, RacePredictor } from '../types/index.js';

const VDOT_RACE_TIMES: Record<number, { '5k': number; '10k': number; half: number; marathon: number }> = {
  30: { '5k': 3600, '10k': 7477, half: 16477, marathon: 33955 },
  35: { '5k': 2948, '10k': 6124, half: 13462, marathon: 27821 },
  40: { '5k': 2516, '10k': 5222, half: 11475, marathon: 23715 },
  45: { '5k': 2194, '10k': 4554, half: 9994, marathon: 20648 },
  50: { '5k': 1940, '10k': 4026, half: 8834, marathon: 18237 },
  55: { '5k': 1736, '10k': 3603, half: 7900, marathon: 16319 },
  60: { '5k': 1569, '10k': 3256, half: 7139, marathon: 14745 },
  65: { '5k': 1427, '10k': 2962, half: 6499, marathon: 13430 },
  70: { '5k': 1307, '10k': 2713, half: 5955, marathon: 12313 },
  75: { '5k': 1202, '10k': 2496, half: 5489, marathon: 11347 },
  80: { '5k': 1110, '10k': 2306, half: 5087, marathon: 10493 },
  85: { '5k': 1030, '10k': 2138, half: 4735, marathon: 9730 },
};

function secondsToHms(s: number): string {
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  return [h, m, sec].map((v) => String(v).padStart(2, '0')).join(':');
}

function interpolateVdot(vdot: number, key: keyof (typeof VDOT_RACE_TIMES)[number]): number {
  const floor = Math.floor(vdot / 5) * 5;
  const ceil = floor + 5;
  const low = VDOT_RACE_TIMES[floor]?.[key];
  const high = VDOT_RACE_TIMES[ceil]?.[key];
  if (!low || !high) return VDOT_RACE_TIMES[Math.min(85, Math.max(30, floor))]?.[key] ?? 0;
  const frac = (vdot - floor) / 5;
  return Math.round(low + (high - low) * frac);
}

export class AnalyticsService {
  constructor(
    private db: Pool,
    private redis: Redis,
  ) {}

  async getProgress(userId: string): Promise<ProgressSummary> {
    const cached = await this.redis.get(`analytics:progress:${userId}`);
    if (cached) return JSON.parse(cached) as ProgressSummary;

    const now = new Date();
    const weekStart = new Date(now);
    weekStart.setDate(now.getDate() - now.getDay());

    const [weeklyRes, streakRes, totalRes, sessionRes, targetRes] = await Promise.all([
      this.db.query(
        `SELECT COALESCE(SUM(distance_km), 0) as km
         FROM run_records
         WHERE user_id = $1 AND started_at >= $2`,
        [userId, weekStart.toISOString()],
      ),
      this.db.query(
        `SELECT COUNT(DISTINCT DATE(started_at)) as streak_days
         FROM run_records
         WHERE user_id = $1 AND started_at >= NOW() - INTERVAL '30 days'`,
        [userId],
      ),
      this.db.query(
        `SELECT COUNT(*) as total FROM run_records WHERE user_id = $1`,
        [userId],
      ),
      this.db.query(
        `SELECT COUNT(*) as completed FROM training_sessions ts
         JOIN training_plans tp ON tp.id = ts.plan_id
         WHERE tp.user_id = $1 AND ts.status = 'completed' AND ts.scheduled_date >= $2`,
        [userId, weekStart.toISOString()],
      ),
      this.db.query(
        `SELECT COUNT(*) as target FROM training_sessions ts
         JOIN training_plans tp ON tp.id = ts.plan_id
         WHERE tp.user_id = $1 AND ts.scheduled_date >= $2 AND ts.scheduled_date < $2::date + INTERVAL '7 days'
         AND ts.session_type != 'rest'`,
        [userId, weekStart.toISOString()],
      ),
    ]);

    const summary: ProgressSummary = {
      userId,
      weeklyDistanceKm: parseFloat(weeklyRes.rows[0].km),
      sessionsCompleted: parseInt(sessionRes.rows[0].completed),
      sessionTarget: parseInt(targetRes.rows[0].target),
      currentStreakDays: parseInt(streakRes.rows[0].streak_days),
      totalRunsAllTime: parseInt(totalRes.rows[0].total),
    };

    await this.redis.setex(`analytics:progress:${userId}`, 3600, JSON.stringify(summary));
    return summary;
  }

  async getTrends(userId: string): Promise<TrendData> {
    const cached = await this.redis.get(`analytics:trends:${userId}`);
    if (cached) return JSON.parse(cached) as TrendData;

    const [vo2Rows, paceRows] = await Promise.all([
      this.db.query(
        `SELECT DATE_TRUNC('week', recorded_at) as week, AVG(value) as avg_value
         FROM health_metrics
         WHERE user_id = $1 AND metric_type = 'vo2max'
           AND recorded_at >= NOW() - INTERVAL '90 days'
         GROUP BY week ORDER BY week`,
        [userId],
      ),
      this.db.query(
        `SELECT DATE_TRUNC('week', started_at) as week,
                AVG(distance_km / NULLIF(duration_sec, 0) * 3600) as avg_pace_min_per_km
         FROM run_records
         WHERE user_id = $1 AND started_at >= NOW() - INTERVAL '90 days'
           AND distance_km > 0
         GROUP BY week ORDER BY week`,
        [userId],
      ),
    ]);

    const trends: TrendData = {
      userId,
      vo2maxTrend: vo2Rows.rows.map((r) => ({
        date: (r.week as Date).toISOString().split('T')[0],
        value: parseFloat(r.avg_value as string),
      })),
      paceTrend: paceRows.rows.map((r) => ({
        date: (r.week as Date).toISOString().split('T')[0],
        value: parseFloat(r.avg_pace_min_per_km as string),
      })),
    };

    await this.redis.setex(`analytics:trends:${userId}`, 3600, JSON.stringify(trends));
    return trends;
  }

  async getRacePredictor(userId: string): Promise<RacePredictor> {
    const cached = await this.redis.get(`analytics:predictor:${userId}`);
    if (cached) return JSON.parse(cached) as RacePredictor;

    const vo2Row = await this.db.query(
      `SELECT value FROM health_metrics
       WHERE user_id = $1 AND metric_type = 'vo2max'
       ORDER BY recorded_at DESC LIMIT 1`,
      [userId],
    );

    let vdot = vo2Row.rows[0] ? parseFloat(vo2Row.rows[0].value as string) : 40;
    vdot = Math.max(30, Math.min(85, vdot));

    const predictor: RacePredictor = {
      userId,
      currentVdot: vdot,
      predictions: [
        {
          distance: '5K',
          predictedTime: secondsToHms(interpolateVdot(vdot, '5k')),
          vdot,
          confidenceNote: 'Based on current fitness level',
        },
        {
          distance: '10K',
          predictedTime: secondsToHms(interpolateVdot(vdot, '10k')),
          vdot,
          confidenceNote: 'Based on current fitness level',
        },
        {
          distance: 'Half Marathon',
          predictedTime: secondsToHms(interpolateVdot(vdot, 'half')),
          vdot,
          confidenceNote: 'Based on current fitness level',
        },
        {
          distance: 'Marathon',
          predictedTime: secondsToHms(interpolateVdot(vdot, 'marathon')),
          vdot,
          confidenceNote: 'Based on current fitness level',
        },
      ],
    };

    await this.redis.setex(`analytics:predictor:${userId}`, 3600, JSON.stringify(predictor));
    return predictor;
  }

  async invalidateCache(userId: string): Promise<void> {
    await Promise.all([
      this.redis.del(`analytics:progress:${userId}`),
      this.redis.del(`analytics:trends:${userId}`),
      this.redis.del(`analytics:predictor:${userId}`),
    ]);
  }
}
