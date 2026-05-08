-- ====================
-- Pacr Database Initialization
-- ====================
-- This script runs automatically when the PostgreSQL container is first created
-- It sets up TimescaleDB extension and creates schemas for each microservice

-- Enable TimescaleDB extension
CREATE EXTENSION IF NOT EXISTS timescaledb CASCADE;

-- Enable UUID extension for generating UUIDs
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ====================
-- Create Schemas for Each Microservice
-- ====================

-- Auth Service
CREATE SCHEMA IF NOT EXISTS auth;
COMMENT ON SCHEMA auth IS 'Authentication and authorization service schema';

-- User Service
CREATE SCHEMA IF NOT EXISTS users;
COMMENT ON SCHEMA users IS 'User profiles and preferences service schema';

-- Health Ingestion Service
CREATE SCHEMA IF NOT EXISTS health_metrics;
COMMENT ON SCHEMA health_metrics IS 'Huawei Health data ingestion service schema';

-- Readiness Service
CREATE SCHEMA IF NOT EXISTS readiness;
COMMENT ON SCHEMA readiness IS 'Daily readiness calculation service schema';

-- Plan Service
CREATE SCHEMA IF NOT EXISTS plans;
COMMENT ON SCHEMA plans IS 'Training plan generation service schema';

-- Session Service
CREATE SCHEMA IF NOT EXISTS sessions;
COMMENT ON SCHEMA sessions IS 'Workout session management service schema';

-- Run Tracker Service
CREATE SCHEMA IF NOT EXISTS runs;
COMMENT ON SCHEMA runs IS 'Real-time run tracking service schema';

-- Coach Service
CREATE SCHEMA IF NOT EXISTS coaching_history;
COMMENT ON SCHEMA coaching_history IS 'AI coaching conversation service schema';

-- Analytics Service
CREATE SCHEMA IF NOT EXISTS analytics;
COMMENT ON SCHEMA analytics IS 'Performance analytics service schema';

-- Notification Service
CREATE SCHEMA IF NOT EXISTS notifications;
COMMENT ON SCHEMA notifications IS 'Multi-channel notification service schema';

-- ====================
-- Example Tables (Services will create their own via migrations)
-- ====================

-- Auth Schema: Users and Sessions
CREATE TABLE IF NOT EXISTS auth.users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    is_verified BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    deleted_at TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS auth.sessions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    refresh_token VARCHAR(500) NOT NULL,
    expires_at TIMESTAMPTZ NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    revoked_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_sessions_user_id ON auth.sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_sessions_expires_at ON auth.sessions(expires_at);

-- Users Schema: User Profiles
CREATE TABLE IF NOT EXISTS users.profiles (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
    first_name VARCHAR(100),
    last_name VARCHAR(100),
    date_of_birth DATE,
    gender VARCHAR(20),
    weight_kg DECIMAL(5, 2),
    height_cm DECIMAL(5, 2),
    experience_level VARCHAR(50), -- beginner, intermediate, advanced, elite
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_profiles_user_id ON users.profiles(user_id);

-- Health Metrics Schema: Time-series data
CREATE TABLE IF NOT EXISTS health_metrics.heart_rate (
    time TIMESTAMPTZ NOT NULL,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    bpm INTEGER NOT NULL,
    source VARCHAR(50), -- huawei_health, manual, etc.
    metadata JSONB
);

-- Convert to TimescaleDB hypertable
SELECT create_hypertable('health_metrics.heart_rate', 'time', if_not_exists => TRUE);

CREATE TABLE IF NOT EXISTS health_metrics.sleep (
    time TIMESTAMPTZ NOT NULL,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    duration_minutes INTEGER,
    deep_sleep_minutes INTEGER,
    light_sleep_minutes INTEGER,
    rem_sleep_minutes INTEGER,
    awake_minutes INTEGER,
    sleep_quality_score INTEGER, -- 0-100
    metadata JSONB
);

SELECT create_hypertable('health_metrics.sleep', 'time', if_not_exists => TRUE);

CREATE TABLE IF NOT EXISTS health_metrics.daily_steps (
    time TIMESTAMPTZ NOT NULL,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    steps INTEGER NOT NULL,
    distance_meters DECIMAL(10, 2),
    calories_burned INTEGER,
    metadata JSONB
);

SELECT create_hypertable('health_metrics.daily_steps', 'time', if_not_exists => TRUE);

-- Readiness Schema
CREATE TABLE IF NOT EXISTS readiness.daily_scores (
    date DATE NOT NULL,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    readiness_score INTEGER CHECK (readiness_score >= 0 AND readiness_score <= 100),
    sleep_score INTEGER,
    hrv_score INTEGER,
    resting_hr_score INTEGER,
    recovery_score INTEGER,
    training_load_score INTEGER,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    PRIMARY KEY (user_id, date)
);

CREATE INDEX IF NOT EXISTS idx_readiness_user_date ON readiness.daily_scores(user_id, date DESC);

-- Plans Schema
CREATE TABLE IF NOT EXISTS plans.training_plans (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    goal_type VARCHAR(50), -- 5k, 10k, half_marathon, marathon
    goal_time VARCHAR(20), -- target finish time
    start_date DATE NOT NULL,
    end_date DATE NOT NULL,
    weeks INTEGER NOT NULL,
    status VARCHAR(50) DEFAULT 'active', -- active, completed, paused, cancelled
    plan_data JSONB NOT NULL, -- Full plan structure
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_plans_user_id ON plans.training_plans(user_id);
CREATE INDEX IF NOT EXISTS idx_plans_status ON plans.training_plans(status);

-- Runs Schema: Time-series GPS and metrics data
CREATE TABLE IF NOT EXISTS runs.run_sessions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    started_at TIMESTAMPTZ NOT NULL,
    ended_at TIMESTAMPTZ,
    distance_meters DECIMAL(10, 2),
    duration_seconds INTEGER,
    avg_pace_per_km INTEGER, -- seconds per km
    avg_heart_rate INTEGER,
    max_heart_rate INTEGER,
    calories_burned INTEGER,
    elevation_gain_meters DECIMAL(8, 2),
    status VARCHAR(50) DEFAULT 'active', -- active, completed, paused, cancelled
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_runs_user_id ON runs.run_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_runs_started_at ON runs.run_sessions(started_at DESC);

CREATE TABLE IF NOT EXISTS runs.gps_points (
    time TIMESTAMPTZ NOT NULL,
    run_id UUID NOT NULL REFERENCES runs.run_sessions(id) ON DELETE CASCADE,
    latitude DECIMAL(10, 8) NOT NULL,
    longitude DECIMAL(11, 8) NOT NULL,
    altitude_meters DECIMAL(8, 2),
    accuracy_meters DECIMAL(6, 2),
    speed_mps DECIMAL(5, 2),
    heart_rate INTEGER
);

SELECT create_hypertable('runs.gps_points', 'time', if_not_exists => TRUE);

-- Analytics Schema
CREATE TABLE IF NOT EXISTS analytics.weekly_summaries (
    week_start_date DATE NOT NULL,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    total_runs INTEGER,
    total_distance_km DECIMAL(10, 2),
    total_duration_minutes INTEGER,
    avg_pace_per_km INTEGER,
    total_elevation_gain_meters DECIMAL(10, 2),
    acute_training_load DECIMAL(8, 2),
    chronic_training_load DECIMAL(8, 2),
    training_stress_balance DECIMAL(8, 2),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    PRIMARY KEY (user_id, week_start_date)
);

CREATE INDEX IF NOT EXISTS idx_analytics_user_week ON analytics.weekly_summaries(user_id, week_start_date DESC);

-- Notifications Schema
CREATE TABLE IF NOT EXISTS notifications.messages (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    type VARCHAR(50) NOT NULL, -- push, email, in_app
    title VARCHAR(255),
    body TEXT NOT NULL,
    data JSONB,
    status VARCHAR(50) DEFAULT 'pending', -- pending, sent, failed, read
    scheduled_for TIMESTAMPTZ,
    sent_at TIMESTAMPTZ,
    read_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_notifications_user_id ON notifications.messages(user_id);
CREATE INDEX IF NOT EXISTS idx_notifications_status ON notifications.messages(status);
CREATE INDEX IF NOT EXISTS idx_notifications_scheduled ON notifications.messages(scheduled_for) WHERE status = 'pending';

-- ====================
-- Grant Permissions
-- ====================

-- Grant schema usage to pacr user (matches docker-compose database user)
GRANT USAGE ON SCHEMA auth TO pacr;
GRANT USAGE ON SCHEMA users TO pacr;
GRANT USAGE ON SCHEMA health_metrics TO pacr;
GRANT USAGE ON SCHEMA readiness TO pacr;
GRANT USAGE ON SCHEMA plans TO pacr;
GRANT USAGE ON SCHEMA sessions TO pacr;
GRANT USAGE ON SCHEMA runs TO pacr;
GRANT USAGE ON SCHEMA coaching_history TO pacr;
GRANT USAGE ON SCHEMA analytics TO pacr;
GRANT USAGE ON SCHEMA notifications TO pacr;

-- Grant all privileges on all tables in schemas to pacr user
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA auth TO pacr;
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA users TO pacr;
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA health_metrics TO pacr;
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA readiness TO pacr;
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA plans TO pacr;
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA sessions TO pacr;
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA runs TO pacr;
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA coaching_history TO pacr;
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA analytics TO pacr;
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA notifications TO pacr;

-- Grant sequence privileges
GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA auth TO pacr;
GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA users TO pacr;
GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA health_metrics TO pacr;
GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA readiness TO pacr;
GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA plans TO pacr;
GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA sessions TO pacr;
GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA runs TO pacr;
GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA coaching_history TO pacr;
GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA analytics TO pacr;
GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA notifications TO pacr;

-- Set default privileges for future tables
ALTER DEFAULT PRIVILEGES IN SCHEMA auth GRANT ALL ON TABLES TO pacr;
ALTER DEFAULT PRIVILEGES IN SCHEMA users GRANT ALL ON TABLES TO pacr;
ALTER DEFAULT PRIVILEGES IN SCHEMA health_metrics GRANT ALL ON TABLES TO pacr;
ALTER DEFAULT PRIVILEGES IN SCHEMA readiness GRANT ALL ON TABLES TO pacr;
ALTER DEFAULT PRIVILEGES IN SCHEMA plans GRANT ALL ON TABLES TO pacr;
ALTER DEFAULT PRIVILEGES IN SCHEMA sessions GRANT ALL ON TABLES TO pacr;
ALTER DEFAULT PRIVILEGES IN SCHEMA runs GRANT ALL ON TABLES TO pacr;
ALTER DEFAULT PRIVILEGES IN SCHEMA coaching_history GRANT ALL ON TABLES TO pacr;
ALTER DEFAULT PRIVILEGES IN SCHEMA analytics GRANT ALL ON TABLES TO pacr;
ALTER DEFAULT PRIVILEGES IN SCHEMA notifications GRANT ALL ON TABLES TO pacr;

-- ====================
-- Utility Functions
-- ====================

-- Function to automatically update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Apply updated_at trigger to relevant tables
CREATE TRIGGER update_auth_users_updated_at BEFORE UPDATE ON auth.users
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_users_profiles_updated_at BEFORE UPDATE ON users.profiles
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_plans_training_plans_updated_at BEFORE UPDATE ON plans.training_plans
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ====================
-- Continuous Aggregates (TimescaleDB)
-- ====================

-- Hourly heart rate averages
CREATE MATERIALIZED VIEW IF NOT EXISTS health_metrics.heart_rate_hourly
WITH (timescaledb.continuous) AS
SELECT
    time_bucket('1 hour', time) AS bucket,
    user_id,
    AVG(bpm) AS avg_bpm,
    MIN(bpm) AS min_bpm,
    MAX(bpm) AS max_bpm,
    COUNT(*) AS sample_count
FROM health_metrics.heart_rate
GROUP BY bucket, user_id
WITH NO DATA;

-- Refresh policy for continuous aggregate
SELECT add_continuous_aggregate_policy('health_metrics.heart_rate_hourly',
    start_offset => INTERVAL '3 days',
    end_offset => INTERVAL '1 hour',
    schedule_interval => INTERVAL '1 hour',
    if_not_exists => TRUE
);

-- ====================
-- Data Retention Policies
-- ====================

-- Keep raw GPS points for 90 days, aggregate older data
SELECT add_retention_policy('runs.gps_points', INTERVAL '90 days', if_not_exists => TRUE);

-- Keep raw heart rate data for 1 year
SELECT add_retention_policy('health_metrics.heart_rate', INTERVAL '365 days', if_not_exists => TRUE);

-- ====================
-- Completion Message
-- ====================

DO $$
BEGIN
    RAISE NOTICE 'Pacr database initialization completed successfully!';
    RAISE NOTICE 'TimescaleDB version: %', (SELECT extversion FROM pg_extension WHERE extname = 'timescaledb');
    RAISE NOTICE 'All schemas and example tables have been created.';
    RAISE NOTICE 'Services can now run their own migrations to add additional tables.';
END $$;
