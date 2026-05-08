/**
 * Migration 4: Seed Data
 * Creates test data for development and testing
 */

exports.up = (pgm) => {
  // Fixed UUID for test user
  const testUserId = '550e8400-e29b-41d4-a716-446655440000';

  // =====================================
  // INSERT TEST USER
  // =====================================
  pgm.sql(`
    INSERT INTO users (
      id,
      email,
      display_name,
      timezone,
      onboarding_complete,
      subscription_tier,
      locale,
      created_at
    ) VALUES (
      '${testUserId}',
      'test@pacr.app',
      'Test Runner',
      'Europe/London',
      true,
      'free',
      'en-GB',
      NOW()
    );
  `);

  // =====================================
  // INSERT RUNNER PROFILE
  // =====================================
  pgm.sql(`
    INSERT INTO runner_profiles (
      user_id,
      goal_type,
      experience_level,
      vo2max_estimate,
      weekly_days,
      available_days,
      height_cm,
      weight_kg
    ) VALUES (
      '${testUserId}',
      'half_marathon',
      'intermediate',
      45.0,
      4,
      ARRAY['Mon', 'Wed', 'Thu', 'Sat'],
      175.0,
      70.0
    );
  `);

  // =====================================
  // INSERT 7 DAYS OF HEALTH METRICS
  // =====================================

  // Helper function to generate health metrics for the last 7 days
  const healthMetrics = [];

  for (let i = 6; i >= 0; i--) {
    const date = `NOW() - INTERVAL '${i} days'`;

    // HRV RMSSD (range 55-72)
    const hrv = 55 + Math.floor(Math.random() * 18);
    healthMetrics.push(`('${testUserId}', ${date}, 'hrv_rmssd', ${hrv}, 'huawei_health', 'valid')`);

    // Resting HR (range 52-58)
    const restingHr = 52 + Math.floor(Math.random() * 7);
    healthMetrics.push(`('${testUserId}', ${date}, 'resting_hr', ${restingHr}, 'huawei_health', 'valid')`);

    // Sleep Quality (range 68-82)
    const sleepQuality = 68 + Math.floor(Math.random() * 15);
    healthMetrics.push(`('${testUserId}', ${date}, 'sleep_quality', ${sleepQuality}, 'huawei_health', 'valid')`);

    // Sleep Duration (range 380-460 minutes)
    const sleepDuration = 380 + Math.floor(Math.random() * 81);
    healthMetrics.push(`('${testUserId}', ${date}, 'sleep_duration_min', ${sleepDuration}, 'huawei_health', 'valid')`);

    // SpO2 (range 96-98)
    const spo2 = 96 + Math.floor(Math.random() * 3);
    healthMetrics.push(`('${testUserId}', ${date}, 'spo2', ${spo2}, 'huawei_health', 'valid')`);
  }

  // Insert all health metrics
  pgm.sql(`
    INSERT INTO health_metrics (
      user_id,
      recorded_at,
      metric_type,
      value,
      source,
      quality_flag
    ) VALUES
      ${healthMetrics.join(',\n      ')};
  `);

  // =====================================
  // INSERT ADDITIONAL REALISTIC DATA
  // =====================================

  // Add some Deep Sleep and REM Sleep metrics
  pgm.sql(`
    INSERT INTO health_metrics (
      user_id,
      recorded_at,
      metric_type,
      value,
      source,
      quality_flag
    ) VALUES
      ('${testUserId}', NOW() - INTERVAL '1 day', 'deep_sleep_min', 95, 'huawei_health', 'valid'),
      ('${testUserId}', NOW() - INTERVAL '1 day', 'rem_sleep_min', 110, 'huawei_health', 'valid'),
      ('${testUserId}', NOW() - INTERVAL '2 days', 'deep_sleep_min', 88, 'huawei_health', 'valid'),
      ('${testUserId}', NOW() - INTERVAL '2 days', 'rem_sleep_min', 105, 'huawei_health', 'valid'),
      ('${testUserId}', NOW() - INTERVAL '3 days', 'deep_sleep_min', 92, 'huawei_health', 'valid'),
      ('${testUserId}', NOW() - INTERVAL '3 days', 'rem_sleep_min', 115, 'huawei_health', 'valid');
  `);

  // Add a sample training plan
  pgm.sql(`
    INSERT INTO training_plans (
      id,
      user_id,
      goal_type,
      start_date,
      race_date,
      total_weeks,
      current_week,
      current_phase,
      vdot_at_gen,
      status,
      generation_ver,
      adaptations
    ) VALUES (
      uuid_generate_v4(),
      '${testUserId}',
      'half_marathon',
      CURRENT_DATE - INTERVAL '2 weeks',
      CURRENT_DATE + INTERVAL '10 weeks',
      12,
      3,
      'base',
      45.0,
      'active',
      'v1.0',
      '[]'::jsonb
    );
  `);

  // Add some training sessions for the test plan
  pgm.sql(`
    INSERT INTO training_sessions (
      plan_id,
      scheduled_date,
      session_type,
      target_distance_km,
      target_pace_zone,
      target_hr_zone,
      rpe_target,
      structure,
      status
    )
    SELECT
      tp.id,
      CURRENT_DATE + (n || ' days')::interval,
      CASE
        WHEN n % 7 = 0 THEN 'rest'::session_type_enum
        WHEN n % 7 = 1 THEN 'easy'::session_type_enum
        WHEN n % 7 = 3 THEN 'interval'::session_type_enum
        WHEN n % 7 = 6 THEN 'long_run'::session_type_enum
        ELSE 'easy'::session_type_enum
      END,
      CASE
        WHEN n % 7 = 0 THEN NULL
        WHEN n % 7 = 6 THEN 16.0
        ELSE 8.0
      END,
      CASE
        WHEN n % 7 = 0 THEN NULL
        WHEN n % 7 = 3 THEN 'Z4'::pace_zone_enum
        ELSE 'Z2'::pace_zone_enum
      END,
      CASE
        WHEN n % 7 = 0 THEN NULL
        WHEN n % 7 = 3 THEN 'Z4'::hr_zone_enum
        ELSE 'Z2'::hr_zone_enum
      END,
      CASE
        WHEN n % 7 = 0 THEN NULL
        WHEN n % 7 = 3 THEN 7
        WHEN n % 7 = 6 THEN 6
        ELSE 4
      END,
      '{}'::jsonb,
      'planned'::session_status_enum
    FROM training_plans tp, generate_series(1, 7) AS n
    WHERE tp.user_id = '${testUserId}'
    LIMIT 7;
  `);

  // Add a sample completed run
  pgm.sql(`
    INSERT INTO run_records (
      user_id,
      started_at,
      ended_at,
      distance_km,
      duration_sec,
      avg_pace_sec_km,
      avg_hr_bpm,
      max_hr_bpm,
      elevation_gain_m,
      cadence_avg,
      hr_zone_breakdown,
      splits,
      ai_debrief
    ) VALUES (
      '${testUserId}',
      NOW() - INTERVAL '3 days',
      NOW() - INTERVAL '3 days' + INTERVAL '45 minutes',
      8.5,
      2700,
      318,
      145,
      165,
      85.5,
      172.0,
      '{"Z1": 5, "Z2": 60, "Z3": 25, "Z4": 10, "Z5": 0}'::jsonb,
      '[
        {"km": 1, "time_sec": 320, "pace_sec_km": 320, "hr_avg": 140},
        {"km": 2, "time_sec": 315, "pace_sec_km": 315, "hr_avg": 145},
        {"km": 3, "time_sec": 318, "pace_sec_km": 318, "hr_avg": 146}
      ]'::jsonb,
      'Great run! Your pace was consistent throughout. Heart rate stayed in the aerobic zone. Consider maintaining this effort for your easy runs.'
    );
  `);

  // Log success
  pgm.sql(`
    DO $$
    BEGIN
      RAISE NOTICE 'Seed data inserted successfully!';
      RAISE NOTICE 'Test user ID: ${testUserId}';
      RAISE NOTICE 'Test user email: test@pacr.app';
    END $$;
  `);
};

exports.down = (pgm) => {
  const testUserId = '550e8400-e29b-41d4-a716-446655440000';

  // Delete all data for test user (cascades will handle related records)
  pgm.sql(`DELETE FROM users WHERE id = '${testUserId}';`);
};
