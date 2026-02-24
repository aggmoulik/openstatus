#!/bin/bash

# Test Render Deployment Locally
# This script simulates a Render deployment using Docker Compose

set -e

echo "🚀 Testing OpenStatus Render Deployment Locally..."

# Check if Docker is running
if ! docker info > /dev/null 2>&1; then
    echo "❌ Docker is not running. Please start Docker first."
    exit 1
fi

# Check if docker-compose is available
if ! command -v docker-compose > /dev/null 2>&1; then
    echo "❌ docker-compose is not installed. Please install docker-compose first."
    exit 1
fi

# Create a temporary directory for the test
TEMP_DIR=$(mktemp -d)
trap "rm -rf $TEMP_DIR" EXIT

echo "📁 Creating test environment in $TEMP_DIR..."

# Copy necessary files to temp directory
cp -r deployments/render/full-stack $TEMP_DIR/
cp -r packages/db $TEMP_DIR/
cp package.json bun.lockb $TEMP_DIR/ 2>/dev/null || cp package.json package-lock.json $TEMP_DIR/ 2>/dev/null || true

# Create a docker-compose file for testing
cat > $TEMP_DIR/docker-compose.test.yaml << 'EOF'
version: '3.8'

networks:
  openstatus:
    driver: bridge

volumes:
  postgres-data:
  redis-data:

services:
  # PostgreSQL Database (simulating Render)
  postgres:
    image: postgres:15-alpine
    container_name: openstatus-postgres
    networks:
      - openstatus
    ports:
      - "5432:5432"
    environment:
      POSTGRES_DB: openstatus
      POSTGRES_USER: openstatus
      POSTGRES_PASSWORD: openstatus123
    volumes:
      - postgres-data:/var/lib/postgresql/data
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U openstatus -d openstatus -h localhost"]
      interval: 10s
      timeout: 5s
      retries: 5
      start_period: 10s
    restart: unless-stopped

  # Redis Cache (simulating Render)
  redis:
    image: redis:7-alpine
    container_name: openstatus-redis
    networks:
      - openstatus
    ports:
      - "6379:6379"
    command: redis-server --requirepass redis123
    volumes:
      - redis-data:/data
    healthcheck:
      test: ["CMD", "redis-cli", "-a", "redis123", "ping"]
      interval: 10s
      timeout: 5s
      retries: 3
    restart: unless-stopped

  # API Server
  api:
    build:
      context: .
      dockerfile: apps/server/Dockerfile
    container_name: openstatus-api
    networks:
      - openstatus
    ports:
      - "3001:3000"
    environment:
      DATABASE_URL: postgresql://openstatus:openstatus123@postgres:5432/openstatus
      REDIS_URL: redis://:redis123@redis:6379
      PORT: 3000
      NODE_ENV: development
      AUTH_SECRET: test-secret-for-local-development-32-chars
      SELF_HOST: "true"
    depends_on:
      postgres:
        condition: service_healthy
      redis:
        condition: service_healthy
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:3000/ping"]
      interval: 15s
      timeout: 10s
      retries: 3
      start_period: 30s
    restart: unless-stopped

  # Dashboard
  dashboard:
    build:
      context: .
      dockerfile: apps/dashboard/Dockerfile
    container_name: openstatus-dashboard
    networks:
      - openstatus
    ports:
      - "3002:3000"
    environment:
      DATABASE_URL: postgresql://openstatus:openstatus123@postgres:5432/openstatus
      NEXT_PUBLIC_URL: http://localhost:3002
      PORT: 3000
      NODE_ENV: development
      AUTH_SECRET: test-secret-for-local-development-32-chars
    depends_on:
      postgres:
        condition: service_healthy
      api:
        condition: service_healthy
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:3000/"]
      interval: 15s
      timeout: 10s
      retries: 3
      start_period: 45s
    restart: unless-stopped

  # Status Page
  status-page:
    build:
      context: .
      dockerfile: apps/status-page/Dockerfile
    container_name: openstatus-status-page
    networks:
      - openstatus
    ports:
      - "3003:3000"
    environment:
      DATABASE_URL: postgresql://openstatus:openstatus123@postgres:5432/openstatus
      NEXT_PUBLIC_URL: http://localhost:3003
      PORT: 3000
      NODE_ENV: development
      AUTH_SECRET: test-secret-for-local-development-32-chars
    depends_on:
      postgres:
        condition: service_healthy
      api:
        condition: service_healthy
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:3000/"]
      interval: 15s
      timeout: 10s
      retries: 3
      start_period: 45s
    restart: unless-stopped
EOF

# Change to temp directory
cd $TEMP_DIR

echo "🔨 Building and starting services..."

# Start the services
docker-compose -f docker-compose.test.yaml up -d --build

echo "⏳ Waiting for services to be healthy..."

# Wait for services to be healthy
for service in postgres redis api dashboard status-page; do
    echo "  Waiting for $service..."
    timeout 300 bash -c "
        until docker-compose -f docker-compose.test.yaml ps $service | grep -q 'Up (healthy)'; do
            echo '    Still waiting...'
            sleep 10
        done
    " || {
        echo "❌ Service $service failed to become healthy"
        docker-compose -f docker-compose.test.yaml logs $service
        exit 1
    }
    echo "  ✅ $service is healthy"
done

echo "🎉 All services are healthy!"

# Test connectivity
echo "🔍 Testing service connectivity..."

# Test database connectivity
echo "  Testing database connection..."
docker-compose -f docker-compose.test.yaml exec -T postgres psql -U openstatus -d openstatus -c "SELECT 1;" > /dev/null || {
    echo "❌ Database connection failed"
    exit 1
}

# Test API health
echo "  Testing API health..."
curl -f http://localhost:3001/ping > /dev/null || {
    echo "❌ API health check failed"
    exit 1
}

# Test dashboard
echo "  Testing dashboard..."
curl -f http://localhost:3002/ > /dev/null || {
    echo "❌ Dashboard health check failed"
    exit 1
}

# Test status page
echo "  Testing status page..."
curl -f http://localhost:3003/ > /dev/null || {
    echo "❌ Status page health check failed"
    exit 1
}

echo "✅ All connectivity tests passed!"

echo ""
echo "🌐 Services are now running locally:"
echo "  Dashboard: http://localhost:3002"
echo "  Status Page: http://localhost:3003"
echo "  API: http://localhost:3001"
echo ""
echo "📊 View logs with: docker-compose -f $TEMP_DIR/docker-compose.test.yaml logs -f"
echo "🛑 Stop services with: docker-compose -f $TEMP_DIR/docker-compose.test.yaml down"
echo ""

# Ask if user wants to keep services running
read -p "Do you want to keep the services running? (y/N): " -n 1 -r
echo
if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    echo "🛑 Stopping services..."
    docker-compose -f docker-compose.test.yaml down
    echo "✅ Services stopped"
else
    echo "🚀 Services will continue running. Use the commands above to manage them."
fi
