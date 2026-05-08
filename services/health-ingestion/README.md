# Health Ingestion Service

Huawei Health data ingestion service for Pacr. Receives health metrics from the Android app, validates data, detects anomalies, writes to TimescaleDB, and publishes events to Kafka.

## Responsibility

This service is responsible for:
- Receiving batch health metric data from the Android app
- Validating and sanitizing incoming data
- Detecting anomalies in health metrics (HRV=0, HR=0, sleep<60min)
- Writing validated metrics to the TimescaleDB hypertable
- Publishing `health.ingested` events to Kafka for downstream services
- Supporting historical data sync for first-time onboarding (up to 30 days)
- Providing sync status for users

## Tech Stack

- Node.js 22
- Fastify v5
- TypeScript
- PostgreSQL 16 + TimescaleDB (health_metrics hypertable)
- Apache Kafka
- Zod (schema validation)

## API Endpoints

### POST /api/v1/health/sync

Sync a batch of health metrics (up to 100 records).

**Request Body:**
```json
{
  "userId": "550e8400-e29b-41d4-a716-446655440000",
  "metrics": [
    {
      "userId": "550e8400-e29b-41d4-a716-446655440000",
      "recordedAt": "2026-05-08T10:00:00Z",
      "metricType": "hrv_rmssd",
      "value": 65,
      "source": "huawei_health"
    }
  ]
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "totalRecords": 5,
    "validRecords": 4,
    "anomaliesDetected": 1,
    "recordsInserted": 5,
    "anomalyDetails": [
      {
        "metricType": "hrv_rmssd",
        "value": 0,
        "recordedAt": "2026-05-08T10:00:00Z",
        "reason": "HRV is zero"
      }
    ]
  },
  "metadata": {
    "timestamp": "2026-05-08T10:05:00Z",
    "requestId": "uuid"
  }
}
```

### POST /api/v1/health/sync/historical

Sync historical health metrics for first-time onboarding (up to 30 days, max 15,000 records).

**Request Body:**
```json
{
  "userId": "550e8400-e29b-41d4-a716-446655440000",
  "metrics": [ /* array of health metrics */ ]
}
```

**Response:** Same as `/sync` endpoint

**Processing:**
- Validates that all data is within the last 30 days
- Processes in batches of 500 records
- Returns aggregated results

### GET /api/v1/health/sync/status/:userId

Get sync status for a user.

**Response:**
```json
{
  "success": true,
  "data": {
    "userId": "550e8400-e29b-41d4-a716-446655440000",
    "lastSyncAt": "2026-05-08T10:00:00Z",
    "totalRecordsIngested": 1234,
    "anomaliesLast7Days": 3,
    "recentAnomalies": [
      {
        "metricType": "hrv_rmssd",
        "recordedAt": "2026-05-07T08:00:00Z",
        "value": 0,
        "reason": "HRV is zero"
      }
    ]
  },
  "metadata": {
    "timestamp": "2026-05-08T10:05:00Z",
    "requestId": "uuid"
  }
}
```

### GET /health

Health check endpoint.

**Response:**
```json
{
  "status": "healthy",
  "service": "health-ingestion",
  "timestamp": "2026-05-08T10:00:00Z"
}
```

## Metric Types

Supported metric types:
- `hrv_rmssd` - Heart Rate Variability (RMSSD)
- `resting_hr` - Resting Heart Rate
- `sleep_quality` - Sleep Quality Score (0-100)
- `sleep_duration_min` - Sleep Duration (minutes)
- `deep_sleep_min` - Deep Sleep Duration (minutes)
- `rem_sleep_min` - REM Sleep Duration (minutes)
- `spo2` - Blood Oxygen Saturation (%)
- `stress_score` - Stress Score
- `vo2max` - VO2 Max Estimate
- `cadence` - Running Cadence
- `ground_contact_ms` - Ground Contact Time
- `stride_length_cm` - Stride Length
- `vertical_oscillation_cm` - Vertical Oscillation

## Anomaly Detection Rules

The service automatically detects and flags anomalies:

| Metric Type | Anomaly Condition | Quality Flag |
|-------------|-------------------|--------------|
| `hrv_rmssd` | value = 0 or value < 0 or value > 200 | `anomaly` |
| `resting_hr` | value = 0 or value < 30 or value > 120 | `anomaly` |
| `sleep_duration_min` | value < 60 | `anomaly` |
| `spo2` | value < 80 or value > 100 | `anomaly` |
| `sleep_quality` | value < 0 or value > 100 | `anomaly` |
| All others | - | `valid` |

## Kafka Events

### Published Events

**Topic:** `health.ingested`

**Event Format:**
```json
{
  "eventId": "uuid",
  "eventType": "health.ingested",
  "timestamp": "2026-05-08T10:00:00Z",
  "userId": "550e8400-e29b-41d4-a716-446655440000",
  "payload": {
    "metricsCount": 10,
    "anomaliesCount": 1,
    "metricTypes": ["hrv_rmssd", "resting_hr"],
    "timeRange": {
      "start": "2026-05-08T08:00:00Z",
      "end": "2026-05-08T10:00:00Z"
    }
  },
  "metadata": {
    "service": "health-ingestion",
    "version": "1.0"
  }
}
```

## Environment Variables

```bash
# Server
PORT=3003
NODE_ENV=development
LOG_LEVEL=info

# Database
DATABASE_URL=postgresql://pacr:pacr_dev_password@localhost:5433/pacr_dev

# Kafka
KAFKA_BROKERS=localhost:9093
KAFKA_CLIENT_ID=health-ingestion

# Batch Processing
MAX_BATCH_SIZE=100
MAX_HISTORICAL_BATCH_SIZE=15000
HISTORICAL_BATCH_CHUNK_SIZE=500
MAX_HISTORICAL_DAYS=30
```

## Development

### Prerequisites
- Node.js 22+
- PostgreSQL 16 + TimescaleDB
- Apache Kafka
- Docker & Docker Compose (optional)

### Setup

1. Install dependencies:
```bash
npm install
```

2. Create `.env` file:
```bash
cp .env.example .env
```

3. Start infrastructure (from root directory):
```bash
docker compose up -d postgres kafka
```

4. Start development server:
```bash
npm run dev
```

The service will be available at `http://localhost:3003`

### Available Scripts

- `npm run dev` - Start development server with hot reload
- `npm run build` - Build TypeScript to JavaScript
- `npm start` - Start production server
- `npm test` - Run all tests with coverage
- `npm run test:watch` - Run tests in watch mode
- `npm run test:integration` - Run integration tests only
- `npm run lint` - Run ESLint
- `npm run format` - Run Prettier
- `npm run type-check` - Run TypeScript type checking

## Testing

### Unit Tests

```bash
npm test
```

Unit tests cover:
- ✅ Anomaly detection rules
- ✅ Metric validation
- ✅ Historical time range validation
- ✅ Batch processing logic
- ✅ Service layer logic

### Integration Tests

```bash
npm run test:integration
```

Integration tests verify:
- ✅ Database insertion
- ✅ Anomaly flagging in database
- ✅ Upsert behavior on conflicts
- ✅ Batch processing with real database

**Note:** Integration tests require a running PostgreSQL instance with the DATABASE_URL environment variable set.

## Database Schema

This service writes to the `health_metrics` TimescaleDB hypertable:

```sql
CREATE TABLE health_metrics (
  user_id UUID NOT NULL,
  recorded_at TIMESTAMPTZ NOT NULL,
  metric_type metric_type_enum NOT NULL,
  value FLOAT NOT NULL,
  source TEXT,
  quality_flag quality_flag_enum DEFAULT 'valid',
  PRIMARY KEY (user_id, recorded_at, metric_type)
);
```

**Indexes:**
- `(user_id, metric_type, recorded_at DESC)` - Fast metric type queries
- `(user_id, recorded_at DESC)` - Fast time-range queries

## Docker

### Build Image

```bash
docker build -t pacr/health-ingestion:latest .
```

### Run Container

```bash
docker run -p 3003:3003 \
  -e DATABASE_URL=postgresql://... \
  -e KAFKA_BROKERS=kafka:9092 \
  pacr/health-ingestion:latest
```

## Deployment

This service is automatically deployed via GitHub Actions:
- Commits to `develop` → Dev environment
- Commits to `main` → Staging → Production (manual approval)

## Monitoring

### Health Check

```bash
curl http://localhost:3003/health
```

### Metrics

Key metrics to monitor:
- Request rate and latency
- Anomaly detection rate
- Kafka event publish rate
- Database connection pool stats
- Batch processing time

### Logs

Structured JSON logs include:
- Timestamp
- Log level
- Service name
- Request ID
- Message
- Metadata

## Troubleshooting

### Service won't start

1. Check environment variables are set
2. Verify PostgreSQL is running and accessible
3. Verify Kafka is running and accessible
4. Check port 3003 is not in use

### Database connection errors

1. Verify DATABASE_URL is correct
2. Check PostgreSQL is running: `docker compose ps postgres`
3. Test connection: `psql $DATABASE_URL`

### Kafka connection errors

1. Check KAFKA_BROKERS configuration
2. Verify Kafka is running: `docker compose ps kafka`
3. Check topic exists: `kafka-topics --list --bootstrap-server localhost:9092`

### Tests failing

1. Ensure test database is accessible
2. Check TimescaleDB extension is installed
3. Run migrations: `npm run db:migrate` (from root)

## Related Services

- **readiness-service** - Consumes `health.ingested` events
- **plan-service** - Uses health metrics for plan adaptation
- **analytics-service** - Aggregates health metrics

## References

- [CLAUDE.md](../../CLAUDE.md) - Architecture guidelines
- [Database Migrations](../../migrations/) - Schema definitions
- [API Standards](../../docs/api-standards.md) - API conventions
