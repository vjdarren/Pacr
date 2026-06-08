/**
 * Migration 1: Core Tables
 * Creates the foundational tables for Pacr: users, runner_profiles, training_plans, training_sessions, run_records
 */

exports.up = (pgm) => {
  // Enable UUID extension
  pgm.sql('CREATE EXTENSION IF NOT EXISTS "uuid-ossp";');

  // Create ENUM types
  pgm.createType('sex_enum', ['M', 'F', 'X', 'prefer_not_to_say']);
  pgm.createType('subscription_tier_enum', ['free', 'pro', 'elite']);
  pgm.createType('goal_type_enum', ['5k', '10k', 'half_marathon', 'marathon', 'general_fitness']);
  pgm.createType('experience_level_enum', ['beginner', 'intermediate', 'advanced']);
  pgm.createType('training_phase_enum', ['base', 'build', 'peak', 'taper']);
  pgm.createType('plan_status_enum', ['active', 'completed', 'abandoned']);
  pgm.createType('session_type_enum', ['easy', 'tempo', 'interval', 'long_run', 'recovery', 'rest', 'race']);
  pgm.createType('pace_zone_enum', ['Z1', 'Z2', 'Z3', 'Z4', 'Z5']);
  pgm.createType('hr_zone_enum', ['Z1', 'Z2', 'Z3', 'Z4', 'Z5']);
  pgm.createType('session_status_enum', ['planned', 'completed', 'skipped', 'adapted']);

  // =====================================
  // USERS TABLE
  // =====================================
  pgm.sql('DROP TABLE IF EXISTS users CASCADE;');

  pgm.createTable('users', {
    id: {
      type: 'uuid',
      primaryKey: true,
      default: pgm.func('uuid_generate_v4()'),
    },
    email: {
      type: 'varchar(255)',
      notNull: true,
      unique: true,
    },
    password_hash: {
      type: 'varchar(255)',
    },
    hms_open_id: {
      type: 'varchar(255)',
      unique: true,
    },
    huawei_account_id: {
      type: 'varchar(255)',
      unique: true,
    },
    display_name: {
      type: 'varchar(255)',
    },
    date_of_birth: {
      type: 'date',
    },
    sex: {
      type: 'sex_enum',
    },
    subscription_tier: {
      type: 'subscription_tier_enum',
      notNull: true,
      default: 'free',
    },
    subscription_expiry: {
      type: 'timestamptz',
    },
    locale: {
      type: 'varchar(10)',
      default: 'en-US',
    },
    timezone: {
      type: 'varchar(50)',
      default: 'UTC',
    },
    onboarding_complete: {
      type: 'boolean',
      notNull: true,
      default: false,
    },
    created_at: {
      type: 'timestamptz',
      notNull: true,
      default: pgm.func('NOW()'),
    },
    updated_at: {
      type: 'timestamptz',
      notNull: true,
      default: pgm.func('NOW()'),
    },
    deleted_at: {
      type: 'timestamptz',
    },
  });

  // Add comment to users table
  pgm.sql(`COMMENT ON TABLE users IS 'Core user accounts and authentication data'`);

  // =====================================
  // RUNNER_PROFILES TABLE
  // =====================================
  pgm.createTable('runner_profiles', {
    user_id: {
      type: 'uuid',
      primaryKey: true,
      references: 'users(id)',
      onDelete: 'CASCADE',
    },
    goal_type: {
      type: 'goal_type_enum',
    },
    target_race_date: {
      type: 'date',
    },
    experience_level: {
      type: 'experience_level_enum',
    },
    vo2max_estimate: {
      type: 'float',
    },
    weekly_days: {
      type: 'integer',
      check: 'weekly_days >= 0 AND weekly_days <= 7',
    },
    max_session_min: {
      type: 'integer',
    },
    injury_history: {
      type: 'jsonb',
      default: '[]',
    },
    available_days: {
      type: 'text[]',
      default: pgm.func("ARRAY[]::text[]"),
    },
    height_cm: {
      type: 'float',
    },
    weight_kg: {
      type: 'float',
    },
  });

  pgm.sql(`COMMENT ON TABLE runner_profiles IS 'Runner-specific profile data and training preferences'`);

  // =====================================
  // TRAINING_PLANS TABLE
  // =====================================
  pgm.createTable('training_plans', {
    id: {
      type: 'uuid',
      primaryKey: true,
      default: pgm.func('uuid_generate_v4()'),
    },
    user_id: {
      type: 'uuid',
      notNull: true,
      references: 'users(id)',
      onDelete: 'CASCADE',
    },
    goal_type: {
      type: 'goal_type_enum',
      notNull: true,
    },
    start_date: {
      type: 'date',
      notNull: true,
    },
    race_date: {
      type: 'date',
    },
    total_weeks: {
      type: 'integer',
      notNull: true,
    },
    current_week: {
      type: 'integer',
      notNull: true,
      default: 1,
    },
    current_phase: {
      type: 'training_phase_enum',
      notNull: true,
      default: 'base',
    },
    vdot_at_gen: {
      type: 'float',
    },
    status: {
      type: 'plan_status_enum',
      notNull: true,
      default: 'active',
    },
    generation_ver: {
      type: 'text',
    },
    adaptations: {
      type: 'jsonb',
      default: '[]',
    },
    created_at: {
      type: 'timestamptz',
      notNull: true,
      default: pgm.func('NOW()'),
    },
  });

  pgm.sql(`COMMENT ON TABLE training_plans IS 'AI-generated training plans for user goals'`);

  // =====================================
  // TRAINING_SESSIONS TABLE
  // =====================================
  pgm.createTable('training_sessions', {
    id: {
      type: 'uuid',
      primaryKey: true,
      default: pgm.func('uuid_generate_v4()'),
    },
    plan_id: {
      type: 'uuid',
      notNull: true,
      references: 'training_plans(id)',
      onDelete: 'CASCADE',
    },
    scheduled_date: {
      type: 'date',
      notNull: true,
    },
    session_type: {
      type: 'session_type_enum',
      notNull: true,
    },
    target_distance_km: {
      type: 'float',
    },
    target_duration_min: {
      type: 'float',
    },
    target_pace_zone: {
      type: 'pace_zone_enum',
    },
    target_hr_zone: {
      type: 'hr_zone_enum',
    },
    rpe_target: {
      type: 'integer',
      check: 'rpe_target >= 1 AND rpe_target <= 10',
    },
    structure: {
      type: 'jsonb',
      default: '{}',
    },
    status: {
      type: 'session_status_enum',
      notNull: true,
      default: 'planned',
    },
    completed_run_id: {
      type: 'uuid',
    },
    created_at: {
      type: 'timestamptz',
      notNull: true,
      default: pgm.func('NOW()'),
    },
  });

  pgm.sql(`COMMENT ON TABLE training_sessions IS 'Individual workout sessions within training plans'`);

  // =====================================
  // RUN_RECORDS TABLE
  // =====================================
  pgm.createTable('run_records', {
    id: {
      type: 'uuid',
      primaryKey: true,
      default: pgm.func('uuid_generate_v4()'),
    },
    user_id: {
      type: 'uuid',
      notNull: true,
      references: 'users(id)',
      onDelete: 'CASCADE',
    },
    session_id: {
      type: 'uuid',
      references: 'training_sessions(id)',
      onDelete: 'SET NULL',
    },
    started_at: {
      type: 'timestamptz',
      notNull: true,
    },
    ended_at: {
      type: 'timestamptz',
    },
    distance_km: {
      type: 'float',
    },
    duration_sec: {
      type: 'integer',
    },
    avg_pace_sec_km: {
      type: 'integer',
    },
    avg_hr_bpm: {
      type: 'integer',
    },
    max_hr_bpm: {
      type: 'integer',
    },
    elevation_gain_m: {
      type: 'float',
    },
    cadence_avg: {
      type: 'float',
    },
    hr_zone_breakdown: {
      type: 'jsonb',
      default: '{}',
    },
    splits: {
      type: 'jsonb',
      default: '[]',
    },
    gps_track_url: {
      type: 'text',
    },
    ai_debrief: {
      type: 'text',
    },
    huawei_sync_id: {
      type: 'text',
      unique: true,
    },
    created_at: {
      type: 'timestamptz',
      notNull: true,
      default: pgm.func('NOW()'),
    },
  });

  pgm.sql(`COMMENT ON TABLE run_records IS 'Completed running activities with metrics and GPS data'`);

  // Add foreign key from training_sessions.completed_run_id to run_records.id
  pgm.addConstraint('training_sessions', 'fk_completed_run', {
    foreignKeys: {
      columns: 'completed_run_id',
      references: 'run_records(id)',
      onDelete: 'SET NULL',
    },
  });
};

exports.down = (pgm) => {
  // Drop tables in reverse order
  pgm.dropConstraint('training_sessions', 'fk_completed_run');
  pgm.dropTable('run_records');
  pgm.dropTable('training_sessions');
  pgm.dropTable('training_plans');
  pgm.dropTable('runner_profiles');
  pgm.dropTable('users');

  // Drop ENUM types
  pgm.dropType('session_status_enum');
  pgm.dropType('hr_zone_enum');
  pgm.dropType('pace_zone_enum');
  pgm.dropType('session_type_enum');
  pgm.dropType('plan_status_enum');
  pgm.dropType('training_phase_enum');
  pgm.dropType('experience_level_enum');
  pgm.dropType('goal_type_enum');
  pgm.dropType('subscription_tier_enum');
  pgm.dropType('sex_enum');

  // Drop UUID extension
  pgm.sql('DROP EXTENSION IF EXISTS "uuid-ossp";');
};
