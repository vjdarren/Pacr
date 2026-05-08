# Pacr Quick Start Guide

This guide will help you get started with Pacr development quickly.

## Initial Setup (One-time)

### 1. Clone Repository
```bash
git clone <repository-url>
cd pacr
```

### 2. Install Prerequisites

#### macOS
```bash
# Install Homebrew (if not installed)
/bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"

# Install required tools
brew install node@22
brew install python@3.12
brew install --cask docker

# Start Docker Desktop
open -a Docker
```

#### Linux (Ubuntu/Debian)
```bash
# Node.js 22
curl -fsSL https://deb.nodesource.com/setup_22.x | sudo -E bash -
sudo apt-get install -y nodejs

# Python 3.12
sudo apt-get update
sudo apt-get install -y python3.12 python3.12-venv

# Docker
curl -fsSL https://get.docker.com -o get-docker.sh
sudo sh get-docker.sh
```

### 3. Configure Environment

```bash
# Make setup script executable
chmod +x scripts/setup-dev.sh

# Run setup script
./scripts/setup-dev.sh
```

This script will:
- Check prerequisites
- Create `.env` file from template
- Start infrastructure services (PostgreSQL, Redis, Kafka)

### 4. Add API Keys

Edit `.env` file and add your credentials:
```bash
ANTHROPIC_API_KEY=sk-ant-api03-xxxxx
HUAWEI_HEALTH_APP_ID=your_app_id
HUAWEI_HEALTH_APP_SECRET=your_app_secret
```

## Running Services

### Infrastructure Only

```bash
# Start all infrastructure
docker-compose up -d postgres redis kafka zookeeper

# Check status
docker-compose ps

# View logs
docker-compose logs -f kafka
```

### Node.js Service (Example: auth-service)

```bash
cd services/auth-service

# Install dependencies
npm install

# Run in development mode
npm run dev
```

Service will be at `http://localhost:3001`

### Python Service (Example: plan-service)

```bash
cd services/plan-service

# Create virtual environment
python -m venv venv
source venv/bin/activate  # Windows: venv\Scripts\activate

# Install dependencies
pip install -r requirements.txt

# Run in development mode
uvicorn main:app --reload --port 8001
```

Service will be at `http://localhost:8001`

### All Services with Docker

```bash
# Start everything
docker-compose up

# Start specific services
docker-compose up postgres redis kafka auth-service user-service

# Run in background
docker-compose up -d
```

## Common Tasks

### Database Operations

```bash
# Connect to PostgreSQL
docker-compose exec postgres psql -U pacr -d pacr_dev

# Run SQL file
docker-compose exec -T postgres psql -U pacr -d pacr_dev < scripts/seed-data.sql

# View all schemas
docker-compose exec postgres psql -U pacr -d pacr_dev -c "\dn"

# Backup database
docker-compose exec postgres pg_dump -U pacr pacr_dev > backup.sql

# Restore database
docker-compose exec -T postgres psql -U pacr -d pacr_dev < backup.sql
```

### Kafka Operations

```bash
# List topics
docker-compose exec kafka kafka-topics --list --bootstrap-server localhost:9092

# Create topic
docker-compose exec kafka kafka-topics --create \
  --topic test.topic \
  --bootstrap-server localhost:9092 \
  --partitions 3 \
  --replication-factor 1

# Consume messages
docker-compose exec kafka kafka-console-consumer \
  --topic health.ingested \
  --bootstrap-server localhost:9092 \
  --from-beginning

# Produce test message
docker-compose exec kafka kafka-console-producer \
  --topic test.topic \
  --bootstrap-server localhost:9092
```

### Redis Operations

```bash
# Connect to Redis CLI
docker-compose exec redis redis-cli -a pacr_redis_password

# Get all keys
docker-compose exec redis redis-cli -a pacr_redis_password KEYS '*'

# Get specific key
docker-compose exec redis redis-cli -a pacr_redis_password GET key_name

# Flush all data (careful!)
docker-compose exec redis redis-cli -a pacr_redis_password FLUSHALL
```

### Git Workflow

```bash
# Create feature branch
git checkout -b feature/PACR-123-add-feature

# Make changes and commit
git add .
git commit -m "feat(service-name): add new feature"

# Push to remote
git push origin feature/PACR-123-add-feature

# Create pull request (using gh CLI)
gh pr create --title "Add new feature" --body "Description"
```

### Testing

```bash
# Node.js service
cd services/auth-service
npm test
npm run test:coverage

# Python service
cd services/plan-service
pytest
pytest --cov=. --cov-report=html

# Android
cd mobile/android
./gradlew test
```

### Code Quality

```bash
# Node.js - Lint and format
npm run lint
npm run format
npm run type-check

# Python - Lint and format
ruff check .
black .
mypy .
```

## Accessing Services

### Local Development URLs

| Service | URL | Description |
|---------|-----|-------------|
| PostgreSQL | `localhost:5432` | Database |
| Redis | `localhost:6379` | Cache |
| Kafka | `localhost:9093` | Message broker |
| Kafka UI | http://localhost:8080 | Kafka management |
| auth-service | http://localhost:3001 | Authentication API |
| user-service | http://localhost:3002 | User profiles API |
| health-ingestion | http://localhost:3003 | Health data API |
| readiness-service | http://localhost:3004 | Readiness scores API |
| session-service | http://localhost:3006 | Sessions API |
| run-tracker | http://localhost:3007 | Run tracking API |
| analytics-service | http://localhost:3009 | Analytics API |
| notification-service | http://localhost:3010 | Notifications API |
| plan-service | http://localhost:8001 | Training plans API |
| coach-service | http://localhost:8002 | AI coaching API |

### API Documentation

When services are running:
- Node.js: `http://localhost:<port>/documentation`
- Python: `http://localhost:<port>/docs`

## Troubleshooting

### Ports Already in Use

```bash
# Find process using port
lsof -i :3001

# Kill process
kill -9 <PID>
```

### Docker Issues

```bash
# Stop all containers
docker-compose down

# Remove all containers and volumes (fresh start)
docker-compose down -v

# Rebuild specific service
docker-compose build auth-service

# View container logs
docker-compose logs -f auth-service
```

### Database Connection Issues

```bash
# Check PostgreSQL is running
docker-compose ps postgres

# Test connection
docker-compose exec postgres pg_isready -U pacr

# View PostgreSQL logs
docker-compose logs postgres
```

### Node Modules Issues

```bash
# Clean install
rm -rf node_modules package-lock.json
npm install
```

### Python Virtual Environment Issues

```bash
# Recreate virtual environment
rm -rf venv
python -m venv venv
source venv/bin/activate
pip install -r requirements.txt
```

## Getting Help

- Architecture guide: [CLAUDE.md](../CLAUDE.md)
- Main README: [README.md](../README.md)
- Slack: #pacr-engineering
- GitHub Issues: [Create issue](https://github.com/org/pacr/issues)

## Next Steps

1. Read [CLAUDE.md](../CLAUDE.md) for architecture details
2. Pick a service to work on
3. Read the service's README
4. Make changes and test locally
5. Create pull request
6. Get code review
7. Merge and deploy

## Useful Commands Cheat Sheet

```bash
# Start infrastructure
docker-compose up -d postgres redis kafka

# Stop everything
docker-compose down

# View all running containers
docker-compose ps

# Follow logs for all services
docker-compose logs -f

# Rebuild and restart a service
docker-compose up -d --build auth-service

# Execute command in container
docker-compose exec postgres bash

# Clean everything (nuclear option)
docker-compose down -v
docker system prune -a
```
