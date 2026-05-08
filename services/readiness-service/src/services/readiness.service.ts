import { computeReadiness } from '../scoring/readiness-scorer';
import { fetchTodayMetrics, fetchSevenDayAvgs, upsertReadinessScore } from '../utils/database';
import { getCachedReadiness, setCachedReadiness, invalidateReadinessCache } from '../utils/redis';
import { publishReadinessCalculated } from '../utils/kafka';
import { HealthData, ReadinessResult } from '../types';

export interface TodayReadinessResponse {
  userId: string;
  score: number;
  scoreDate: string;
  overtraining_flag: boolean;
  component_scores: ReadinessResult['component_scores'];
  explanation: string;
  computed_at: string;
  cached: boolean;
}

export const getTodayReadiness = async (userId: string): Promise<TodayReadinessResponse> => {
  const today = new Date().toISOString().split('T')[0];

  // Return cached result if available
  const cached = await getCachedReadiness(userId);
  if (cached) {
    const parsed = JSON.parse(cached) as TodayReadinessResponse;
    return { ...parsed, cached: true };
  }

  return computeAndStoreReadiness(userId, today);
};

export const computeAndStoreReadiness = async (
  userId: string,
  date: string
): Promise<TodayReadinessResponse> => {
  const [todayMetrics, weeklyAvgs] = await Promise.all([
    fetchTodayMetrics(userId, date),
    fetchSevenDayAvgs(userId, date),
  ]);

  const healthData: HealthData = {
    hrv: todayMetrics['hrv_rmssd'],
    hrv7DayAvg: weeklyAvgs['hrv_rmssd'],
    sleepQuality: todayMetrics['sleep_quality'],
    rhr: todayMetrics['resting_hr'],
    rhr7DayAvg: weeklyAvgs['resting_hr'],
    sleepDuration: todayMetrics['sleep_duration_min'],
    stressScore: todayMetrics['stress_score'],
  };

  const result = computeReadiness(healthData);
  const computed_at = new Date().toISOString();

  await upsertReadinessScore(userId, date, result);

  // Publish downstream event (non-blocking — errors are logged, not thrown)
  publishReadinessCalculated(
    userId,
    result.score,
    result.overtraining_flag,
    result.component_scores,
    computed_at
  );

  const response: TodayReadinessResponse = {
    userId,
    score: result.score,
    scoreDate: date,
    overtraining_flag: result.overtraining_flag,
    component_scores: result.component_scores,
    explanation: result.explanation,
    computed_at,
    cached: false,
  };

  // Cache for 6 hours; invalidated on next health.ingested event
  await setCachedReadiness(userId, response);

  return response;
};

export const invalidateAndRecompute = async (userId: string): Promise<void> => {
  await invalidateReadinessCache(userId);

  const today = new Date().toISOString().split('T')[0];
  try {
    await computeAndStoreReadiness(userId, today);
  } catch (error) {
    // Recomputation is best-effort; the next GET request will retry
    console.error(`Failed to recompute readiness for user ${userId}:`, error);
  }
};
