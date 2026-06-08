# Pacr — AI Running Coach

## Stack
- Android: Kotlin + Jetpack Compose, MVVM + Clean Architecture, Health Connect API
- Backend: Node.js 22 + Fastify v5 + TypeScript
- AI Services: Python 3.12 + FastAPI + Anthropic Claude API
- Database: PostgreSQL 16 + TimescaleDB, Redis 7, Apache Kafka
- Mobile CI: GitHub Actions + Fastlane

## Services & Ports
- auth-service :3001 — JWT, OAuth, Huawei Account Kit SSO
- user-service :3002 — profiles, preferences, subscription state
- health-ingestion :3003 — Health Connect batch ingest → Kafka
- readiness-service :3004 — daily readiness score (0–100) from HRV/sleep/RHR
- plan-service :8001 — Python, training plan generation + adaptation (Claude Opus)
- session-service :3006 — session CRUD, scheduling, completion tracking
- run-tracker :3007 — live GPS + HR stream, splits, offline-first
- coach-service :8002 — Python, conversational AI coaching (Gemini 2.5 Flash)
- analytics-service :3009 — VO2Max trend, pace trend, race predictor
- notification-service :3010 — FCM + HMS push, scheduled digests

## Health Data Integration
- Integration Point: Android Health Connect (`androidx.health.connect.client`)
- Aggregates data from connected wearables: Garmin, Samsung, Fitbit, Huawei, Polar, and others.
- Permissions: `android.permission.health.READ_HEART_RATE`, `READ_SLEEP`, `READ_HEART_RATE_VARIABILITY`, `READ_OXYGEN_SATURATION`, `READ_RESTING_HEART_RATE`, `READ_VO2_MAX`, `READ_STEPS`, `READ_DISTANCE`, `READ_EXERCISE`, `WRITE_EXERCISE`

## Database Conventions
- UUIDs for all PKs, snake_case, soft deletes via deleted_at
- TimescaleDB hypertables for: health_metrics, run_tracking, analytics
- health_metrics partitioned by (user_id, recorded_at), 7-day chunks
- Each service owns its own PostgreSQL schema

## Kafka Topics
health.ingested → readiness.calculated → plan.adapted
session.scheduled, session.completed
run.started, run.metrics, run.completed
coaching.message, plan.generated

## API Conventions
- Base: /api/v1/{resource}/{id}
- Auth: Bearer JWT, 15min access / 7day refresh
- Success: { success: true, data: {}, metadata: { timestamp, requestId } }
- Error: { success: false, error: { code, message, details } }

## Safety Guardrails — never remove or bypass
- Max 10% weekly mileage increase — hard cap, no exceptions
- Minimum 1 rest day + 1 easy day per week — non-configurable
- HRV >15% below 7-day average → flag overtraining, reduce load
- Readiness <30 → rest day only, hide run CTA
- AI coach never diagnoses injury — always refer to physiotherapist

## AI API Usage
- Plan generation: algorithmic (Daniels VDOT engine, no LLM)
- Real-time coaching: gemini-2.5-flash (Google Gemini)
- Cache coach context in Redis, 5min TTL
- Max conversation history: last 10 messages
- Rate limit: 20 messages/day free, unlimited Pro