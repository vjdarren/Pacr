# Pacr - AI Running Coach

Pacr is an AI-powered running coach application that integrates with Huawei Health to provide personalized training plans, real-time coaching, and performance analytics powered by Claude AI.

## Architecture

Pacr uses a microservices architecture with 10 specialized services:

### Backend Services (Node.js + Fastify)
- **auth-service** (3001) - Authentication and authorization
- **user-service** (3002) - User profiles and preferences
- **health-ingestion** (3003) - Huawei Health data ingestion
- **readiness-service** (3004) - Daily readiness score calculation
- **session-service** (3006) - Workout session management
- **run-tracker** (3007) - Real-time run tracking
- **analytics-service** (3009) - Performance analytics
- **notification-service** (3010) - Multi-channel notifications

### AI Services (Python + FastAPI)
- **plan-service** (8001) - Training plan generation with Claude Opus
- **coach-service** (8002) - Conversational coaching with Claude Sonnet

### Mobile
- **Android** - Kotlin + Jetpack Compose

### Infrastructure
- **PostgreSQL 16** with TimescaleDB for time-series data
- **Redis 7** for caching and session management
- **Apache Kafka** for event-driven messaging
- **Docker** for containerization

## Quick Start

### Prerequisites

- Docker 24.0+
- Docker Compose 2.20+
- Node.js 22+
- Python 3.12+
- Java 17+ (for Android development)
- Android Studio (for mobile development)

### Environment Setup

1. Clone the repository:
```bash
git clone <repository-url>
cd pacr
```

2. Create a `.env` file in the root directory:
```bash
# Anthropic API
ANTHROPIC_API_KEY=your_anthropic_api_key

# Huawei Health Integration
HUAWEI_HEALTH_APP_ID=your_huawei_app_id
HUAWEI_HEALTH_APP_SECRET=your_huawei_app_secret

# Firebase Cloud Messaging
FCM_SERVER_KEY=your_fcm_server_key

# Email Configuration (optional)
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your_email
SMTP_PASSWORD=your_password
```

3. Start infrastructure services:
```bash
docker-compose up -d postgres redis kafka zookeeper
```

4. Wait for services to be healthy:
```bash
docker-compose ps
```

### Running Services Locally

#### Node.js Services

```bash
# Example: Running auth-service
cd services/auth-service
npm install
npm run dev
```

Repeat for each Node.js service you want to run locally.

#### Python Services

```bash
# Example: Running plan-service
cd services/plan-service
python -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate
pip install -r requirements.txt
uvicorn main:app --reload --port 8001
```

#### Android App

```bash
cd mobile/android
./gradlew installDebug
```

Or open the project in Android Studio and run it.

### Running All Services with Docker

```bash
docker-compose up
```

This will start all infrastructure and application services.

## Development

### Project Structure

```
pacr/
├── .github/workflows/     # GitHub Actions CI/CD
├── services/              # Microservices
│   ├── auth-service/
│   ├── user-service/
│   ├── health-ingestion/
│   ├── readiness-service/
│   ├── plan-service/
│   ├── session-service/
│   ├── run-tracker/
│   ├── coach-service/
│   ├── analytics-service/
│   └── notification-service/
├── mobile/
│   └── android/          # Android app
├── shared/               # Shared code and types
│   ├── proto/           # Protocol buffers
│   ├── types/           # TypeScript types
│   └── config/          # Shared configs
├── infrastructure/       # Infrastructure as code
│   ├── docker/
│   ├── k8s/
│   └── terraform/
├── docs/                # Documentation
├── scripts/             # Utility scripts
├── docker-compose.yml   # Local development environment
├── CLAUDE.md           # Architecture guide
└── README.md
```

### Code Standards

#### TypeScript/JavaScript
- ESLint + Prettier for formatting
- Strict TypeScript mode
- Follow Airbnb style guide

#### Python
- Black for formatting
- Ruff for linting
- Type hints required
- Follow PEP 8

#### Kotlin
- ktlint for linting
- Follow Kotlin coding conventions
- Prefer coroutines for async operations

### Testing

Run tests for a specific service:

```bash
# Node.js services
cd services/<service-name>
npm test

# Python services
cd services/<service-name>
pytest

# Android
cd mobile/android
./gradlew test
```

### Database Migrations

Each service manages its own database schema. Migration tools:
- Node.js services: Use Prisma or node-pg-migrate
- Python services: Use Alembic

### API Documentation

API documentation is available via OpenAPI/Swagger:
- Node.js services: `http://localhost:<port>/documentation`
- Python services: `http://localhost:<port>/docs`

## Architecture Documentation

For detailed architecture guidelines, conventions, and best practices, see [CLAUDE.md](./CLAUDE.md).

Key topics covered:
- Microservice boundaries and responsibilities
- Database schemas and TimescaleDB usage
- Event-driven architecture with Kafka
- API conventions and standards
- AI integration with Claude API
- Security guidelines
- Monitoring and observability
- Performance requirements

## Deployment

### Development Environment
Commits to `develop` branch automatically deploy to dev environment.

### Staging Environment
Commits to `main` branch automatically deploy to staging environment.

### Production Environment
Requires manual approval after staging deployment succeeds.

## Monitoring

### Local Development
- Kafka UI: http://localhost:8080
- (Optional) Grafana: http://localhost:3000
- (Optional) Prometheus: http://localhost:9090

### Production
- Prometheus + Grafana for metrics
- OpenTelemetry + Jaeger for distributed tracing
- Structured JSON logging with ELK stack

## Contributing

1. Create a feature branch from `develop`:
   ```bash
   git checkout -b feature/TICKET-123-description
   ```

2. Make your changes and commit:
   ```bash
   git commit -m "feat(service-name): description"
   ```

3. Push and create a pull request:
   ```bash
   git push origin feature/TICKET-123-description
   ```

### Commit Message Format
```
<type>(<scope>): <subject>

<body>

<footer>
```

Types: `feat`, `fix`, `docs`, `style`, `refactor`, `test`, `chore`

## Troubleshooting

### Services won't start
1. Check Docker containers: `docker-compose ps`
2. View logs: `docker-compose logs <service-name>`
3. Verify environment variables in `.env`
4. Check port conflicts: `lsof -i :<port>`

### Database connection issues
1. Ensure PostgreSQL is running: `docker-compose ps postgres`
2. Check connection string in service config
3. Verify credentials match `.env` file

### Kafka issues
1. Check Kafka and Zookeeper are running
2. View topics: `docker-compose exec kafka kafka-topics --list --bootstrap-server localhost:9092`
3. Check consumer groups: `docker-compose exec kafka kafka-consumer-groups --list --bootstrap-server localhost:9092`

## License

Proprietary - All rights reserved

## Support

For questions and support:
- Slack: #pacr-engineering
- Email: engineering@pacr.app
- Documentation: https://docs.pacr.app

---

**Built with:**
- Node.js 22 + Fastify v5
- Python 3.12 + FastAPI
- Kotlin + Jetpack Compose
- PostgreSQL 16 + TimescaleDB
- Redis 7
- Apache Kafka
- Anthropic Claude API
