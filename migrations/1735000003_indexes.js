/**
 * Migration 3: Indexes
 * Creates performance indexes on all tables for optimal query performance
 */

exports.up = (pgm) => {
  // =====================================
  // HEALTH_METRICS INDEXES
  // =====================================

  // Index for querying metrics by user and metric type, sorted by time
  pgm.createIndex('health_metrics', ['user_id', 'metric_type', 'recorded_at'], {
    name: 'idx_health_metrics_user_metric_time',
    method: 'btree',
  });

  // Index for querying all metrics for a user sorted by time
  pgm.createIndex('health_metrics', ['user_id', 'recorded_at'], {
    name: 'idx_health_metrics_user_time',
    method: 'btree',
  });

  // Index for filtering by quality flag
  pgm.createIndex('health_metrics', ['quality_flag'], {
    name: 'idx_health_metrics_quality',
    method: 'btree',
    where: 'quality_flag != \'valid\'',
  });

  // =====================================
  // TRAINING_SESSIONS INDEXES
  // =====================================

  // Index for querying sessions by plan and date
  pgm.createIndex('training_sessions', ['plan_id', 'scheduled_date'], {
    name: 'idx_training_sessions_plan_date',
    method: 'btree',
  });

  // Partial index for planned sessions only (most common query)
  pgm.createIndex('training_sessions', ['plan_id', 'status', 'scheduled_date'], {
    name: 'idx_training_sessions_planned',
    method: 'btree',
    where: 'status = \'planned\'',
  });

  // Index for finding sessions by completed run
  pgm.createIndex('training_sessions', ['completed_run_id'], {
    name: 'idx_training_sessions_completed_run',
    method: 'btree',
    where: 'completed_run_id IS NOT NULL',
  });

  // Note: Index on user_id via plan is not needed as queries will join through plan_id
  // which is already indexed above. PostgreSQL cannot create functional indexes with subqueries.

  // =====================================
  // RUN_RECORDS INDEXES
  // =====================================

  // Index for querying runs by user, sorted by start time
  pgm.createIndex('run_records', ['user_id', 'started_at'], {
    name: 'idx_run_records_user_started',
    method: 'btree',
  });

  // Index for querying runs by session
  pgm.createIndex('run_records', ['session_id'], {
    name: 'idx_run_records_session',
    method: 'btree',
    where: 'session_id IS NOT NULL',
  });

  // Index for Huawei sync lookups
  pgm.createIndex('run_records', ['huawei_sync_id'], {
    name: 'idx_run_records_huawei_sync',
    method: 'btree',
    where: 'huawei_sync_id IS NOT NULL',
  });

  // =====================================
  // TRAINING_PLANS INDEXES
  // =====================================

  // Index for querying active plans by user
  pgm.createIndex('training_plans', ['user_id', 'status'], {
    name: 'idx_training_plans_user_status',
    method: 'btree',
  });

  // Index for active plans only
  pgm.createIndex('training_plans', ['user_id', 'start_date'], {
    name: 'idx_training_plans_active',
    method: 'btree',
    where: 'status = \'active\'',
  });

  // Index for race date queries
  pgm.createIndex('training_plans', ['race_date'], {
    name: 'idx_training_plans_race_date',
    method: 'btree',
    where: 'race_date IS NOT NULL',
  });

  // =====================================
  // USERS INDEXES
  // =====================================

  // Index for Huawei account lookups
  pgm.createIndex('users', ['huawei_account_id'], {
    name: 'idx_users_huawei_account',
    method: 'btree',
    where: 'huawei_account_id IS NOT NULL',
  });

  // Index for subscription queries
  pgm.createIndex('users', ['subscription_tier', 'subscription_expiry'], {
    name: 'idx_users_subscription',
    method: 'btree',
  });

  // Index for onboarding status
  pgm.createIndex('users', ['onboarding_complete'], {
    name: 'idx_users_onboarding',
    method: 'btree',
    where: 'onboarding_complete = false',
  });

  // =====================================
  // RUNNER_PROFILES INDEXES
  // =====================================

  // Index for querying by goal type
  pgm.createIndex('runner_profiles', ['goal_type'], {
    name: 'idx_runner_profiles_goal',
    method: 'btree',
  });

  // Index for race date queries
  pgm.createIndex('runner_profiles', ['target_race_date'], {
    name: 'idx_runner_profiles_race_date',
    method: 'btree',
    where: 'target_race_date IS NOT NULL',
  });
};

exports.down = (pgm) => {
  // Drop all indexes in reverse order

  // Runner profiles
  pgm.dropIndex('runner_profiles', ['target_race_date'], { name: 'idx_runner_profiles_race_date', ifExists: true });
  pgm.dropIndex('runner_profiles', ['goal_type'], { name: 'idx_runner_profiles_goal', ifExists: true });

  // Users
  pgm.dropIndex('users', ['onboarding_complete'], { name: 'idx_users_onboarding', ifExists: true });
  pgm.dropIndex('users', ['subscription_tier', 'subscription_expiry'], { name: 'idx_users_subscription', ifExists: true });
  pgm.dropIndex('users', ['huawei_account_id'], { name: 'idx_users_huawei_account', ifExists: true });

  // Training plans
  pgm.dropIndex('training_plans', ['race_date'], { name: 'idx_training_plans_race_date', ifExists: true });
  pgm.dropIndex('training_plans', ['user_id', 'start_date'], { name: 'idx_training_plans_active', ifExists: true });
  pgm.dropIndex('training_plans', ['user_id', 'status'], { name: 'idx_training_plans_user_status', ifExists: true });

  // Run records
  pgm.dropIndex('run_records', ['huawei_sync_id'], { name: 'idx_run_records_huawei_sync', ifExists: true });
  pgm.dropIndex('run_records', ['session_id'], { name: 'idx_run_records_session', ifExists: true });
  pgm.dropIndex('run_records', ['user_id', 'started_at'], { name: 'idx_run_records_user_started', ifExists: true });

  // Training sessions
  pgm.dropIndex('training_sessions', ['completed_run_id'], { name: 'idx_training_sessions_completed_run', ifExists: true });
  pgm.dropIndex('training_sessions', ['plan_id', 'status', 'scheduled_date'], { name: 'idx_training_sessions_planned', ifExists: true });
  pgm.dropIndex('training_sessions', ['plan_id', 'scheduled_date'], { name: 'idx_training_sessions_plan_date', ifExists: true });

  // Health metrics
  pgm.dropIndex('health_metrics', ['quality_flag'], { name: 'idx_health_metrics_quality', ifExists: true });
  pgm.dropIndex('health_metrics', ['user_id', 'recorded_at'], { name: 'idx_health_metrics_user_time', ifExists: true });
  pgm.dropIndex('health_metrics', ['user_id', 'metric_type', 'recorded_at'], { name: 'idx_health_metrics_user_metric_time', ifExists: true });
};
