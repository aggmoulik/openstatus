#!/bin/bash

# Test Railway Deployment Locally
# This script simulates a Railway deployment using Docker Compose

set -e

echo "🚀 Testing OpenStatus Railway Deployment Locally..."

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
cp -r deployments/railway/full-stack $TEMP_DIR/
cp -r packages/db $TEMP_DIR/
cp package.json bun.lockb $TEMP_DIR/ 2>/dev/null || cp package.json package-lock.json $TEMP_DIR/ 2>/dev/null || true

# Create a docker-compose file for testing
cat > $TEMP_DIR/docker-compose.test.yaml << 'EOF'
version: '3.8'

networks:
  openstatus:
    driver: bridge

volumes:
  libsql-data:
  redis-data:

services:
  # libSQL Database (simulating Railway)
  libsql:
    build:
      context: .
      dockerfile: full-stack/database/Dockerfile
    container_name: openstatus-libsql
    networks:
      - openstatus
    ports:
      - "8080:8080"
      - "5001:5001"
    environment:
      SQLD_NODE: primary
      SQLD_HTTP_ADDRESS: 0.0.0.0:8080
      SQLD_TCP_ADDRESS: 0.0.0.0:5001
      SQLD_DATA_PATH: /var/lib/sqld
    volumes:
      - libsql-data:/var/lib/sqld
    healthcheck:
      test: ["CMD", "wget", "--no-verbose", "--tries=1", "--spider", "http://localhost:8080/"]
      interval: 10s
      timeout: 5s
      retries: 5
      start_period: 10s
    restart: unless-stopped

  # Redis Cache (simulating Railway)
  redis:
    build:
      context: .
      dockerfile: full-stack/redis/Dockerfile
    container_name: openstatus-redis
    networks:
      - openstatus
    ports:
      - "6379:6379"
    environment:
      REDIS_PASSWORD_FILE: /run/secrets/redis-password
    volumes:
      - redis-data:/data
      - ./redis-secret:/run/secrets:ro
    healthcheck:
      test: ["CMD", "/usr/local/bin/healthcheck.sh"]
      interval: 10s
      timeout: 5s
      retries: 3
      start_period: 5s
    restart: unless-stopped

  # Database Migration
  db-migrate:
    image: oven/bun:1.3.6
    container_name: openstatus-db-migrate
    networks:
      - openstatus
    working_dir: /app/packages/db
    volumes:
      - .:/app
    environment:
      DATABASE_URL: http://libsql:8080
    command: ["sh", "-c", "bun install && bun run migrate"]
    depends_on:
      libsql:
        condition: service_healthy
    restart: "no"

  # API Server
  api:
    build:
      context: .
      dockerfile: full-stack/api/Dockerfile
    container_name: openstatus-api
    networks:
      - openstatus
    ports:
      - "3001:3000"
    environment:
      DATABASE_URL: http://libsql:8080
      PORT: 3000
      NODE_ENV: development
      AUTH_SECRET: test-secret-for-local-development-32-chars
      SELF_HOST: "true"
    depends_on:
      db-migrate:
        condition: service_completed_successfully
      libsql:
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
      dockerfile: full-stack/dashboard/Dockerfile
    container_name: openstatus-dashboard
    networks:
      - openstatus
    ports:
      - "3002:3000"
    environment:
      DATABASE_URL: http://libsql:8080
      NEXT_PUBLIC_URL: http://localhost:3002
      PORT: 3000
      NODE_ENV: development
      AUTH_SECRET: test-secret-for-local-development-32-chars
      AUTH_TRUST_HOST: "true"
    depends_on:
      db-migrate:
        condition: service_completed_successfully
      libsql:
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
      dockerfile: full-stack/status-page/Dockerfile
    container_name: openstatus-status-page
    networks:
      - openstatus
    ports:
      - "3003:3000"
    environment:
      DATABASE_URL: http://libsql:8080
      NEXT_PUBLIC_URL: http://localhost:3003
      PORT: 3000
      NODE_ENV: development
      AUTH_SECRET: test-secret-for-local-development-32-chars
      AUTH_TRUST_HOST: "true"
    depends_on:
      db-migrate:
        condition: service_completed_successfully
      libsql:
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

  # Workflows
  workflows:
    build:
      context: .
      dockerfile: full-stack/workflows/Dockerfile
    container_name: openstatus-workflows
    networks:
      - openstatus
    ports:
      - "3000:3000"
    environment:
      DATABASE_URL: http://libsql:8080
      PORT: 3000
      NODE_ENV: development
    depends_on:
      db-migrate:
        condition: service_completed_successfully
      libsql:
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
EOF

# Create Redis secret file
echo "redis123" > $TEMP_DIR/redis-secret

# Change to temp directory
cd $TEMP_DIR

echo "🔨 Building and starting services..."

# Start the services
docker-compose -f docker-compose.test.yaml up -d --build

echo "⏳ Waiting for services to be healthy..."

# Wait for database migration to complete
echo "  Waiting for database migration..."
timeout 300 bash -c "
    until docker-compose -f docker-compose.test.yaml ps db-migrate | grep -q 'Exited (0)'; do
        echo '    Still running migrations...'
        sleep 10
    done
" || {
    echo "❌ Database migration failed"
    docker-compose -f docker-compose.test.yaml logs db-migrate
    exit 1
}
echo "  ✅ Database migration completed"

# Wait for services to be healthy
for service in libsql redis api dashboard status-page workflows; do
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
curl -f http://localhost:8080/ > /dev/null || {
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
echo "  Workflows: http://localhost:3000"
echo "  Database (HTTP): http://localhost:8080"
echo "  Database (gRPC): localhost:5001"
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
