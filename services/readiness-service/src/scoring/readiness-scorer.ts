import { HealthData, ComponentScore, ComponentScores, ReadinessResult } from '../types';

const WEIGHTS = {
  hrv: 0.3,
  sleepQuality: 0.25,
  rhr: 0.2,
  sleepDuration: 0.15,
  stress: 0.1,
} as const;

// HRV score: 100 if hrv >= 7-day avg; linear drop to 0 at 40% below avg.
export function scoreHrv(hrv: number, avg: number): number {
  if (avg <= 0) return 100;
  if (hrv >= avg) return 100;
  const pctDrop = (avg - hrv) / avg;
  return Math.max(0, 100 * (1 - pctDrop / 0.4));
}

// RHR score: 100 if rhr <= 7-day avg; -10 points per bpm above avg, floor 0.
export function scoreRhr(rhr: number, avg: number): number {
  if (rhr <= avg) return 100;
  return Math.max(0, 100 - (rhr - avg) * 10);
}

// Sleep duration score: linear from 240 min (score=0) to 420 min (score=100).
export function scoreSleepDuration(durationMin: number): number {
  if (durationMin >= 420) return 100;
  if (durationMin <= 240) return 0;
  return ((durationMin - 240) / (420 - 240)) * 100;
}

// Stress score: inverted passthrough.
export function scoreStress(stressValue: number): number {
  return Math.max(0, Math.min(100, 100 - stressValue));
}

const COMPONENT_LABELS: Record<string, string> = {
  hrv: 'HRV recovery',
  sleepQuality: 'sleep quality',
  rhr: 'resting heart rate',
  sleepDuration: 'sleep duration',
  stress: 'stress level',
};

function generateExplanation(
  data: HealthData,
  components: ComponentScores,
  score: number,
  overtrained: boolean
): string {
  const present = (Object.entries(components) as [string, ComponentScore][]).filter(
    ([, c]) => c.hasData
  );

  if (present.length === 0) {
    return (
      'No health data is available to compute a readiness score today. ' +
      'Sync your Huawei Health data to get your personalized readiness score.'
    );
  }

  const sorted = [...present].sort(([, a], [, b]) => a.score - b.score);
  const [worstKey] = sorted[0];
  const worstLabel = COMPONENT_LABELS[worstKey] || worstKey;

  let sentence1: string;
  if (score >= 80) {
    sentence1 = `Your readiness is excellent at ${Math.round(score)}/100, with strong recovery markers across the board.`;
  } else if (score >= 60) {
    sentence1 = `Your readiness score is ${Math.round(score)}/100, indicating good recovery with some room for improvement in ${worstLabel}.`;
  } else if (score >= 40) {
    sentence1 = `Your readiness score of ${Math.round(score)}/100 is moderate — ${worstLabel} is the primary limiting factor today.`;
  } else {
    sentence1 = `Your readiness is low at ${Math.round(score)}/100, driven mainly by insufficient ${worstLabel}.`;
  }

  let sentence2: string;
  if (overtrained && data.hrv !== undefined && data.hrv7DayAvg !== undefined) {
    sentence2 = `Your HRV is more than 15% below your 7-day average (${Math.round(data.hrv)} vs ${Math.round(data.hrv7DayAvg)} ms), a key overtraining signal — rest or an easy session is strongly recommended.`;
  } else if (score < 30) {
    sentence2 = 'Consider a full rest day to allow your body to recover properly.';
  } else if (score < 60) {
    sentence2 = 'A lighter training session today would support recovery while keeping you active.';
  } else {
    sentence2 = "You're well-recovered and ready for your planned training session today.";
  }

  return `${sentence1} ${sentence2}`;
}

export function computeReadiness(data: HealthData): ReadinessResult {
  const components: ComponentScores = {
    hrv: {
      score: 0,
      weight: WEIGHTS.hrv,
      hasData: data.hrv !== undefined && data.hrv7DayAvg !== undefined,
    },
    sleepQuality: {
      score: 0,
      weight: WEIGHTS.sleepQuality,
      hasData: data.sleepQuality !== undefined,
    },
    rhr: {
      score: 0,
      weight: WEIGHTS.rhr,
      hasData: data.rhr !== undefined && data.rhr7DayAvg !== undefined,
    },
    sleepDuration: {
      score: 0,
      weight: WEIGHTS.sleepDuration,
      hasData: data.sleepDuration !== undefined,
    },
    stress: {
      score: 0,
      weight: WEIGHTS.stress,
      hasData: data.stressScore !== undefined,
    },
  };

  // Compute raw component scores
  if (components.hrv.hasData) {
    components.hrv.score = scoreHrv(data.hrv!, data.hrv7DayAvg!);
  }
  if (components.sleepQuality.hasData) {
    components.sleepQuality.score = Math.max(0, Math.min(100, data.sleepQuality!));
  }
  if (components.rhr.hasData) {
    components.rhr.score = scoreRhr(data.rhr!, data.rhr7DayAvg!);
  }
  if (components.sleepDuration.hasData) {
    components.sleepDuration.score = scoreSleepDuration(data.sleepDuration!);
  }
  if (components.stress.hasData) {
    components.stress.score = scoreStress(data.stressScore!);
  }

  // Weighted sum with proportional redistribution for missing components
  const totalAvailableWeight = (Object.values(components) as ComponentScore[])
    .filter((c) => c.hasData)
    .reduce((sum, c) => sum + c.weight, 0);

  let score = 0;
  if (totalAvailableWeight > 0) {
    for (const component of Object.values(components) as ComponentScore[]) {
      if (component.hasData) {
        score += component.score * (component.weight / totalAvailableWeight);
      }
    }
  }

  score = Math.max(0, Math.min(100, score));

  // Safety guardrail: HRV >15% below 7-day average → overtraining flag
  let overtraining_flag = false;
  if (data.hrv !== undefined && data.hrv7DayAvg !== undefined && data.hrv7DayAvg > 0) {
    overtraining_flag = (data.hrv7DayAvg - data.hrv) / data.hrv7DayAvg > 0.15;
  }

  return {
    score,
    overtraining_flag,
    component_scores: components,
    explanation: generateExplanation(data, components, score, overtraining_flag),
  };
}
