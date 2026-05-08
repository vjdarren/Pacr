#!/bin/bash

# ====================
# Pacr Development Environment Setup Script
# ====================
# This script helps you set up your local development environment

set -e

echo "🏃 Pacr Development Environment Setup"
echo "====================================="
echo ""

# Check prerequisites
echo "📋 Checking prerequisites..."

# Check Docker
if ! command -v docker &> /dev/null; then
    echo "❌ Docker is not installed. Please install Docker Desktop."
    exit 1
fi
echo "✅ Docker found: $(docker --version)"

# Check Docker Compose
if ! command -v docker-compose &> /dev/null; then
    echo "❌ Docker Compose is not installed."
    exit 1
fi
echo "✅ Docker Compose found: $(docker-compose --version)"

# Check Node.js
if ! command -v node &> /dev/null; then
    echo "⚠️  Node.js not found. Some services require Node.js 22+"
else
    echo "✅ Node.js found: $(node --version)"
fi

# Check Python
if ! command -v python3 &> /dev/null; then
    echo "⚠️  Python not found. AI services require Python 3.12+"
else
    echo "✅ Python found: $(python3 --version)"
fi

echo ""

# Create .env file if it doesn't exist
if [ ! -f .env ]; then
    echo "📝 Creating .env file from template..."
    cp .env.example .env
    echo "✅ .env file created. Please edit it with your API keys."
    echo ""
    echo "⚠️  IMPORTANT: You need to add the following to .env:"
    echo "   - ANTHROPIC_API_KEY"
    echo "   - HUAWEI_HEALTH_APP_ID"
    echo "   - HUAWEI_HEALTH_APP_SECRET"
    echo ""
    read -p "Press enter to continue after updating .env file..."
else
    echo "✅ .env file already exists"
fi

echo ""

# Start infrastructure services
echo "🚀 Starting infrastructure services (PostgreSQL, Redis, Kafka)..."
docker-compose up -d postgres redis kafka zookeeper kafka-ui

echo ""
echo "⏳ Waiting for services to be healthy..."
sleep 10

# Check service health
echo "🏥 Checking service health..."

if docker-compose ps postgres | grep -q "healthy"; then
    echo "✅ PostgreSQL is healthy"
else
    echo "⚠️  PostgreSQL is not ready yet. Check logs: docker-compose logs postgres"
fi

if docker-compose ps redis | grep -q "healthy"; then
    echo "✅ Redis is healthy"
else
    echo "⚠️  Redis is not ready yet. Check logs: docker-compose logs redis"
fi

if docker-compose ps kafka | grep -q "healthy"; then
    echo "✅ Kafka is healthy"
else
    echo "⚠️  Kafka is not ready yet. Check logs: docker-compose logs kafka"
fi

echo ""
echo "✨ Infrastructure setup complete!"
echo ""
echo "📊 Access Points:"
echo "   - PostgreSQL: localhost:5432"
echo "   - Redis: localhost:6379"
echo "   - Kafka: localhost:9093"
echo "   - Kafka UI: http://localhost:8080"
echo ""
echo "📖 Next Steps:"
echo "   1. Navigate to a service directory: cd services/auth-service"
echo "   2. Install dependencies: npm install (or pip install -r requirements.txt)"
echo "   3. Run the service: npm run dev (or uvicorn main:app --reload)"
echo ""
echo "🛠️  Useful Commands:"
echo "   - View all containers: docker-compose ps"
echo "   - View logs: docker-compose logs -f [service-name]"
echo "   - Stop all: docker-compose down"
echo "   - Stop and remove volumes: docker-compose down -v"
echo ""
