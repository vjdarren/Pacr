# [Service Name]

[Brief description of what this service does]

## Responsibility

This service is responsible for:
- [Primary responsibility 1]
- [Primary responsibility 2]
- [Primary responsibility 3]

## Tech Stack

- Python 3.12
- FastAPI
- PostgreSQL 16 (schema: `[schema_name]`)
- Redis 7 (caching)
- Kafka (event streaming)
- Anthropic Claude API

## API Endpoints

### Health Check
- `GET /health` - Service health status
- `GET /ready` - Readiness probe

### [Resource Name]
- `GET /api/v1/[resource]` - List all [resources]
- `GET /api/v1/[resource]/{id}` - Get [resource] by ID
- `POST /api/v1/[resource]` - Create new [resource]
- `PUT /api/v1/[resource]/{id}` - Update [resource]
- `DELETE /api/v1/[resource]/{id}` - Delete [resource]

## Environment Variables

```bash
# Server
PORT=8001
ENVIRONMENT=development

# Database
DATABASE_URL=postgresql://user:password@localhost:5432/pacr_dev

# Redis
REDIS_URL=redis://:password@localhost:6379

# Kafka
KAFKA_BROKERS=localhost:9093
KAFKA_CLIENT_ID=[service-name]
KAFKA_GROUP_ID=[service-name]-group

# Anthropic Claude API
ANTHROPIC_API_KEY=sk-ant-api03-xxxxx
CLAUDE_MODEL=[model-name]
CLAUDE_MAX_TOKENS=4096
```

## Development

### Prerequisites
- Python 3.12+
- Docker & Docker Compose (for infrastructure)

### Setup

1. Create virtual environment:
```bash
python -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate
```

2. Install dependencies:
```bash
pip install -r requirements.txt
pip install -r requirements-dev.txt  # For development tools
```

3. Create `.env` file:
```bash
cp .env.example .env
```

4. Start infrastructure (from root directory):
```bash
docker-compose up -d postgres redis kafka
```

5. Run database migrations:
```bash
alembic upgrade head
```

6. Start development server:
```bash
uvicorn main:app --reload --port 8001
```

The service will be available at `http://localhost:8001`

### Available Commands

```bash
# Start development server
uvicorn main:app --reload --port 8001

# Run tests
pytest

# Run tests with coverage
pytest --cov=. --cov-report=term --cov-report=html

# Lint code
ruff check .

# Format code
black .

# Type checking
mypy .

# Database migrations
alembic revision --autogenerate -m "migration message"
alembic upgrade head
alembic downgrade -1
```

## Testing

```bash
# Run all tests
pytest

# Run with coverage
pytest --cov=. --cov-report=html

# Run specific test file
pytest tests/test_example.py

# Run tests matching pattern
pytest -k "test_pattern"
```

## Code Style

- **Formatter**: Black (line length: 100)
- **Linter**: Ruff
- **Type Checker**: MyPy
- **Import Sorting**: isort
- **Docstrings**: Google style

## Project Structure

```
[service-name]/
├── app/
│   ├── __init__.py
│   ├── main.py              # FastAPI application
│   ├── config.py            # Configuration
│   ├── models/              # Database models
│   ├── schemas/             # Pydantic schemas
│   ├── routers/             # API routes
│   ├── services/            # Business logic
│   ├── utils/               # Utilities
│   └── dependencies.py      # FastAPI dependencies
├── tests/
│   ├── __init__.py
│   ├── conftest.py
│   └── test_*.py
├── alembic/                 # Database migrations
├── requirements.txt
├── requirements-dev.txt
├── Dockerfile
├── .env.example
└── README.md
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

## Claude API Integration

### Models Used
- **[Use Case 1]**: Claude Opus 4.5 - [Reasoning]
- **[Use Case 2]**: Claude Sonnet 4.5 - [Reasoning]

### Prompt Engineering
[Description of prompt engineering approach]

Example context structure:
```python
context = {
    "user": {
        "id": "uuid",
        "profile": {...}
    },
    "current_state": {...},
    "request": "..."
}
```

### Cost Optimization
- Cache common responses in Redis
- Use efficient context windows
- Batch requests where possible
- Monitor token usage per request

## Monitoring

### Metrics
- Request rate, latency, error rate
- Database connection pool stats
- Redis cache hit rate
- Kafka consumer lag
- Claude API latency and token usage

### Logs
Structured JSON logs with fields:
- `timestamp` - ISO 8601 timestamp
- `level` - ERROR, WARN, INFO, DEBUG
- `service` - Service name
- `request_id` - Correlation ID
- `message` - Log message
- `metadata` - Additional context

## API Documentation

Interactive API documentation:
- Swagger UI: `http://localhost:8001/docs`
- ReDoc: `http://localhost:8001/redoc`
- OpenAPI JSON: `http://localhost:8001/openapi.json`

## Deployment

This service is automatically deployed via GitHub Actions:
- Commits to `develop` → Dev environment
- Commits to `main` → Staging → Production (manual approval)

## Troubleshooting

### Service won't start
1. Check virtual environment is activated
2. Verify `.env` file is configured
3. Check port is not in use: `lsof -i :8001`
4. Review logs in console

### Database connection errors
1. Ensure PostgreSQL is running
2. Verify DATABASE_URL in `.env`
3. Check migrations are applied: `alembic current`

### Claude API errors
1. Verify ANTHROPIC_API_KEY is valid
2. Check API quota and rate limits
3. Review error messages in logs

### Import errors
1. Ensure virtual environment is activated
2. Install dependencies: `pip install -r requirements.txt`
3. Check Python version: `python --version` (should be 3.12+)

## Related Services

- [Related Service 1] - [How they interact]
- [Related Service 2] - [How they interact]

## References

- [CLAUDE.md](../../CLAUDE.md) - Architecture guidelines
- [API Standards](../../docs/api-standards.md) - API conventions
- [AI Integration Guide](../../docs/ai-integration.md) - Claude API best practices
