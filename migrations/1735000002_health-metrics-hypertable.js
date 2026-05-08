/**
 * Migration 2: Health Metrics TimescaleDB Hypertable
 * Creates the health_metrics table for time-series data and converts it to a TimescaleDB hypertable
 */

exports.up = (pgm) => {
  // Enable TimescaleDB extension
  pgm.sql('CREATE EXTENSION IF NOT EXISTS timescaledb;');

  // Create ENUM for metric types
  pgm.createType('metric_type_enum', [
    'hrv_rmssd',
    'resting_hr',
    'sleep_quality',
    'sleep_duration_min',
    'deep_sleep_min',
    'rem_sleep_min',
    'spo2',
    'stress_score',
    'vo2max',
    'cadence',
    'ground_contact_ms',
    'stride_length_cm',
    'vertical_oscillation_cm',
  ]);

  // Create ENUM for quality flags
  pgm.createType('quality_flag_enum', ['valid', 'anomaly', 'estimated']);

  // =====================================
  // HEALTH_METRICS TABLE
  // =====================================
  pgm.createTable('health_metrics', {
    user_id: {
      type: 'uuid',
      notNull: true,
      references: 'users(id)',
      onDelete: 'CASCADE',
    },
    recorded_at: {
      type: 'timestamptz',
      notNull: true,
    },
    metric_type: {
      type: 'metric_type_enum',
      notNull: true,
    },
    value: {
      type: 'float',
      notNull: true,
    },
    source: {
      type: 'text',
    },
    quality_flag: {
      type: 'quality_flag_enum',
      notNull: true,
      default: 'valid',
    },
  });

  // Add composite primary key
  pgm.addConstraint('health_metrics', 'health_metrics_pkey', {
    primaryKey: ['user_id', 'recorded_at', 'metric_type'],
  });

  // Add comment
  pgm.sql(`COMMENT ON TABLE health_metrics IS 'Time-series health and performance metrics from Huawei Health and other sources'`);

  // Convert to TimescaleDB hypertable with 7-day chunks
  pgm.sql(`
    SELECT create_hypertable(
      'health_metrics',
      'recorded_at',
      chunk_time_interval => INTERVAL '7 days',
      if_not_exists => TRUE
    );
  `);

  // Add retention policy: keep data for 2 years
  pgm.sql(`
    SELECT add_retention_policy(
      'health_metrics',
      INTERVAL '2 years',
      if_not_exists => TRUE
    );
  `);

  // Create continuous aggregate for daily averages
  pgm.sql(`
    CREATE MATERIALIZED VIEW health_metrics_daily
    WITH (timescaledb.continuous) AS
    SELECT
      user_id,
      metric_type,
      time_bucket('1 day', recorded_at) AS day,
      AVG(value) AS avg_value,
      MIN(value) AS min_value,
      MAX(value) AS max_value,
      COUNT(*) AS sample_count
    FROM health_metrics
    WHERE quality_flag = 'valid'
    GROUP BY user_id, metric_type, day
    WITH NO DATA;
  `);

  // Add refresh policy for continuous aggregate
  pgm.sql(`
    SELECT add_continuous_aggregate_policy(
      'health_metrics_daily',
      start_offset => INTERVAL '3 days',
      end_offset => INTERVAL '1 hour',
      schedule_interval => INTERVAL '1 hour',
      if_not_exists => TRUE
    );
  `);
};

exports.down = (pgm) => {
  // Drop continuous aggregate policy
  pgm.sql(`SELECT remove_continuous_aggregate_policy('health_metrics_daily', if_exists => TRUE);`);

  // Drop continuous aggregate
  pgm.sql('DROP MATERIALIZED VIEW IF EXISTS health_metrics_daily;');

  // Drop retention policy
  pgm.sql(`SELECT remove_retention_policy('health_metrics', if_exists => TRUE);`);

  // Drop hypertable (this will drop the table)
  pgm.dropTable('health_metrics');

  // Drop ENUM types
  pgm.dropType('quality_flag_enum');
  pgm.dropType('metric_type_enum');

  // Note: We don't drop the timescaledb extension as other tables might use it
};
