import {
  computeReadiness,
  scoreHrv,
  scoreRhr,
  scoreSleepDuration,
  scoreStress,
} from '../../scoring/readiness-scorer';
import { HealthData } from '../../types';

// ──────────────────────────────────────────────
// Component scorer unit tests
// ──────────────────────────────────────────────

describe('scoreHrv', () => {
  it('returns 100 when hrv equals avg', () => {
    expect(scoreHrv(60, 60)).toBe(100);
  });

  it('returns 100 when hrv exceeds avg', () => {
    expect(scoreHrv(65, 60)).toBe(100);
  });

  it('drops linearly: 20% below avg → 50', () => {
    // pctDrop = 0.20 → score = 100*(1 - 0.20/0.40) = 50
    expect(scoreHrv(48, 60)).toBeCloseTo(50, 5);
  });

  it('returns 0 at exactly 40% below avg', () => {
    // pctDrop = 0.40 → score = 100*(1 - 1) = 0
    expect(scoreHrv(36, 60)).toBeCloseTo(0, 5);
  });

  it('floors at 0 when hrv is more than 40% below avg', () => {
    expect(scoreHrv(10, 60)).toBe(0);
  });

  it('returns 100 for avg <= 0 (guard)', () => {
    expect(scoreHrv(0, 0)).toBe(100);
  });
});

describe('scoreRhr', () => {
  it('returns 100 when rhr equals avg', () => {
    expect(scoreRhr(55, 55)).toBe(100);
  });

  it('returns 100 when rhr is below avg', () => {
    expect(scoreRhr(50, 55)).toBe(100);
  });

  it('drops 10 points per bpm above avg', () => {
    expect(scoreRhr(58, 55)).toBeCloseTo(70, 5);
    expect(scoreRhr(60, 55)).toBeCloseTo(50, 5);
    expect(scoreRhr(65, 55)).toBeCloseTo(0, 5);
  });

  it('floors at 0 when rhr is 10+ bpm above avg', () => {
    expect(scoreRhr(70, 55)).toBe(0);
  });
});

describe('scoreSleepDuration', () => {
  it('returns 100 at exactly 420 min (7hrs)', () => {
    expect(scoreSleepDuration(420)).toBe(100);
  });

  it('returns 100 above 420 min', () => {
    expect(scoreSleepDuration(480)).toBe(100);
  });

  it('returns 0 at exactly 240 min (4hrs)', () => {
    expect(scoreSleepDuration(240)).toBe(0);
  });

  it('returns 0 below 240 min', () => {
    expect(scoreSleepDuration(120)).toBe(0);
  });

  it('returns 50 at 330 min (midpoint between 240 and 420)', () => {
    expect(scoreSleepDuration(330)).toBeCloseTo(50, 5);
  });

  it('interpolates linearly', () => {
    // (400 - 240) / (420 - 240) * 100 = 160/180 * 100 ≈ 88.89
    expect(scoreSleepDuration(400)).toBeCloseTo(88.89, 1);
  });
});

describe('scoreStress', () => {
  it('returns 100 for stress = 0', () => {
    expect(scoreStress(0)).toBe(100);
  });

  it('returns 0 for stress = 100', () => {
    expect(scoreStress(100)).toBe(0);
  });

  it('returns 70 for stress = 30', () => {
    expect(scoreStress(30)).toBe(70);
  });

  it('floors at 0 for stress > 100', () => {
    expect(scoreStress(150)).toBe(0);
  });
});

// ──────────────────────────────────────────────
// computeReadiness integration-level unit tests
// ──────────────────────────────────────────────

describe('computeReadiness — full data', () => {
  const fullData: HealthData = {
    hrv: 65,
    hrv7DayAvg: 60,
    sleepQuality: 75,
    rhr: 55,
    rhr7DayAvg: 57,
    sleepDuration: 450,
    stressScore: 30,
  };

  it('computes correct weighted score with all components present', () => {
    // hrv: 65>=60 → 100, weight 0.30
    // sleepQuality: 75, weight 0.25
    // rhr: 55<=57 → 100, weight 0.20
    // sleepDuration: 450>=420 → 100, weight 0.15
    // stress: 100-30=70, weight 0.10
    // score = 100*0.30 + 75*0.25 + 100*0.20 + 100*0.15 + 70*0.10
    //       = 30 + 18.75 + 20 + 15 + 7 = 90.75
    const result = computeReadiness(fullData);
    expect(result.score).toBeCloseTo(90.75, 2);
  });

  it('overtraining_flag is false when hrv >= avg', () => {
    expect(computeReadiness(fullData).overtraining_flag).toBe(false);
  });

  it('all components report hasData = true', () => {
    const { component_scores } = computeReadiness(fullData);
    expect(component_scores.hrv.hasData).toBe(true);
    expect(component_scores.sleepQuality.hasData).toBe(true);
    expect(component_scores.rhr.hasData).toBe(true);
    expect(component_scores.sleepDuration.hasData).toBe(true);
    expect(component_scores.stress.hasData).toBe(true);
  });

  it('returns a non-empty explanation string', () => {
    const { explanation } = computeReadiness(fullData);
    expect(typeof explanation).toBe('string');
    expect(explanation.length).toBeGreaterThan(0);
  });
});

describe('computeReadiness — missing components (weight redistribution)', () => {
  const dataWithoutStress: HealthData = {
    hrv: 65,
    hrv7DayAvg: 60,
    sleepQuality: 75,
    rhr: 55,
    rhr7DayAvg: 57,
    sleepDuration: 450,
    // stressScore intentionally omitted
  };

  it('excludes missing component and redistributes weight proportionally', () => {
    // Available weights: hrv=0.30, sleepQuality=0.25, rhr=0.20, sleepDuration=0.15 → total=0.90
    // hrv raw=100, sleepQuality raw=75, rhr raw=100, sleepDuration raw=100
    // score = 100*(0.30/0.90) + 75*(0.25/0.90) + 100*(0.20/0.90) + 100*(0.15/0.90)
    //       = 33.333 + 20.833 + 22.222 + 16.667 ≈ 93.056
    const result = computeReadiness(dataWithoutStress);
    expect(result.score).toBeCloseTo(93.056, 2);
  });

  it('stress hasData is false, others are true', () => {
    const { component_scores } = computeReadiness(dataWithoutStress);
    expect(component_scores.stress.hasData).toBe(false);
    expect(component_scores.hrv.hasData).toBe(true);
    expect(component_scores.sleepQuality.hasData).toBe(true);
    expect(component_scores.rhr.hasData).toBe(true);
    expect(component_scores.sleepDuration.hasData).toBe(true);
  });

  it('redistributes when HRV avg is missing too', () => {
    const dataWithoutHrvAvg: HealthData = {
      hrv: 65,
      // hrv7DayAvg omitted → hrv component excluded
      sleepQuality: 80,
      sleepDuration: 420,
    };
    // Available: sleepQuality=0.25, sleepDuration=0.15 → total=0.40
    // score = 80*(0.25/0.40) + 100*(0.15/0.40) = 50 + 37.5 = 87.5
    const result = computeReadiness(dataWithoutHrvAvg);
    expect(result.score).toBeCloseTo(87.5, 2);
    expect(result.component_scores.hrv.hasData).toBe(false);
  });

  it('returns score 0 when no data available', () => {
    const result = computeReadiness({});
    expect(result.score).toBe(0);
  });
});

describe('computeReadiness — overtraining flag at 15% HRV drop boundary', () => {
  it('does NOT set flag when HRV is exactly 15% below avg (boundary, not exceeded)', () => {
    // (100 - 85) / 100 = 0.15 which is NOT > 0.15
    const result = computeReadiness({ hrv: 85, hrv7DayAvg: 100 });
    expect(result.overtraining_flag).toBe(false);
  });

  it('sets flag when HRV is just over 15% below avg', () => {
    // (100 - 84) / 100 = 0.16 > 0.15
    const result = computeReadiness({ hrv: 84, hrv7DayAvg: 100 });
    expect(result.overtraining_flag).toBe(true);
  });

  it('sets flag for a realistic case: 7-day avg 60, today 50 (16.7% drop)', () => {
    // (60 - 50) / 60 ≈ 0.167 > 0.15
    const result = computeReadiness({ hrv: 50, hrv7DayAvg: 60 });
    expect(result.overtraining_flag).toBe(true);
  });

  it('computes correct HRV score at exactly 15% drop (62.5)', () => {
    // pctDrop = 0.15 → score = 100*(1 - 0.15/0.40) = 100*0.625 = 62.5
    const result = computeReadiness({ hrv: 85, hrv7DayAvg: 100 });
    expect(result.component_scores.hrv.score).toBeCloseTo(62.5, 5);
  });

  it('does NOT set flag when hrv7DayAvg is missing', () => {
    const result = computeReadiness({ hrv: 50 });
    expect(result.overtraining_flag).toBe(false);
  });
});

describe('computeReadiness — readiness = 0 edge case', () => {
  const worstData: HealthData = {
    hrv: 10,
    hrv7DayAvg: 100,   // 90% drop → score 0
    sleepQuality: 0,
    rhr: 65,
    rhr7DayAvg: 55,    // 10 bpm above → score 0
    sleepDuration: 240, // exactly 4hrs → score 0
    stressScore: 100,   // max stress → score 0
  };

  it('returns score = 0 when all components are at their worst', () => {
    const result = computeReadiness(worstData);
    expect(result.score).toBeCloseTo(0, 5);
  });

  it('sets overtraining_flag when HRV is severely depressed', () => {
    expect(computeReadiness(worstData).overtraining_flag).toBe(true);
  });
});

describe('computeReadiness — readiness = 100 edge case', () => {
  const bestData: HealthData = {
    hrv: 80,
    hrv7DayAvg: 60,   // above avg → 100
    sleepQuality: 100,
    rhr: 50,
    rhr7DayAvg: 57,   // well below avg → 100
    sleepDuration: 480, // above 420 → 100
    stressScore: 0,   // no stress → 100
  };

  it('returns score = 100 when all components are at their best', () => {
    const result = computeReadiness(bestData);
    expect(result.score).toBeCloseTo(100, 5);
  });

  it('does not set overtraining_flag', () => {
    expect(computeReadiness(bestData).overtraining_flag).toBe(false);
  });

  it('all component scores are 100', () => {
    const { component_scores } = computeReadiness(bestData);
    expect(component_scores.hrv.score).toBe(100);
    expect(component_scores.sleepQuality.score).toBe(100);
    expect(component_scores.rhr.score).toBe(100);
    expect(component_scores.sleepDuration.score).toBe(100);
    expect(component_scores.stress.score).toBe(100);
  });
});
