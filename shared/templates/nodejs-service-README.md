# [Service Name]

[Brief description of what this service does]

## Responsibility

This service is responsible for:
- [Primary responsibility 1]
- [Primary responsibility 2]
- [Primary responsibility 3]

## Tech Stack

- Node.js 22
- Fastify v5
- TypeScript
- PostgreSQL 16 (schema: `[schema_name]`)
- Redis 7 (caching)
- Kafka (event streaming)

## API Endpoints

### Health Check
- `GET /health` - Service health status
- `GET /ready` - Readiness probe

### [Resource Name]
- `GET /api/v1/[resource]` - List all [resources]
- `GET /api/v1/[resource]/:id` - Get [resource] by ID
- `POST /api/v1/[resource]` - Create new [resource]
- `PUT /api/v1/[resource]/:id` - Update [resource]
- `DELETE /api/v1/[resource]/:id` - Delete [resource]

## Environment Variables

```bash
# Server
PORT=3001
NODE_ENV=development

# Database
DATABASE_URL=postgresql://user:password@localhost:5432/pacr_dev

# Redis
REDIS_URL=redis://:password@localhost:6379

# Kafka
KAFKA_BROKERS=localhost:9093
KAFKA_CLIENT_ID=[service-name]
KAFKA_GROUP_ID=[service-name]-group

# Authentication (if needed)
JWT_SECRET=your_jwt_secret
```

## Development

### Prerequisites
- Node.js 22+
- Docker & Docker Compose (for infrastructure)

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
docker-compose up -d postgres redis kafka
```

4. Run database migrations:
```bash
npm run migrate
```

5. Start development server:
```bash
npm run dev
```

The service will be available at `http://localhost:[PORT]`

### Available Scripts

- `npm run dev` - Start development server with hot reload
- `npm run build` - Build TypeScript to JavaScript
- `npm start` - Start production server
- `npm test` - Run unit tests
- `npm run test:watch` - Run tests in watch mode
- `npm run test:coverage` - Run tests with coverage
- `npm run lint` - Run ESLint
- `npm run format` - Run Prettier
- `npm run type-check` - Run TypeScript type checking
- `npm run migrate` - Run database migrations

## Testing

```bash
# Run all tests
npm test

# Run tests in watch mode
npm run test:watch

# Run with coverage
npm run test:coverage
```

## Database Schema

This service owns the `[schema_name]` schema in PostgreSQL.

### Tables

#### `[schema_name].[table_name]`
- `id` - UUID primary key
- `user_id` - UUID foreign key to auth.users
- [other columns]
- `created_at` - Timestamp
- `updated_at` - Timestamp

## Kafka Events

### Consumes
- `[topic.name]` - [Description of what triggers consumption]

### Produces
- `[topic.name]` - [Description of what triggers production]

## Monitoring

### Metrics
- Request rate, latency, error rate
- Database connection pool stats
- Redis cache hit rate
- Kafka consumer lag

### Logs
All logs are structured JSON with fields:
- `timestamp` - ISO 8601 timestamp
- `level` - ERROR, WARN, INFO, DEBUG
- `service` - Service name
- `requestId` - Correlation ID
- `message` - Log message
- `metadata` - Additional context

## API Documentation

When running in development mode, Swagger documentation is available at:
- `http://localhost:[PORT]/documentation`

## Deployment

This service is automatically deployed via GitHub Actions:
- Commits to `develop` → Dev environment
- Commits to `main` → Staging → Production (manual approval)

## Troubleshooting

### Service won't start
1. Check Docker containers are running
2. Verify `.env` file is configured
3. Check port is not in use: `lsof -i :[PORT]`
4. Review logs: `npm run dev`

### Database connection errors
1. Ensure PostgreSQL is running: `docker-compose ps postgres`
2. Verify DATABASE_URL in `.env`
3. Test connection: `psql $DATABASE_URL`

### Kafka connection errors
1. Ensure Kafka is running: `docker-compose ps kafka`
2. Check broker address in `.env`
3. View topics: `docker-compose exec kafka kafka-topics --list --bootstrap-server localhost:9092`

## Related Services

- [Related Service 1] - [How they interact]
- [Related Service 2] - [How they interact]

## References

- [CLAUDE.md](../../CLAUDE.md) - Architecture guidelines
- [API Standards](../../docs/api-standards.md) - API conventions
- [Database Guide](../../docs/database.md) - Database patterns
