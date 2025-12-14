# Production Deployment Guide

Complete guide for deploying OpenStatus in production using pre-built Docker images.

## Overview

This guide covers production deployment using pre-built Docker images from GitHub Container Registry (GHCR). These images are automatically built and tested through CI/CD, ensuring consistency and reliability.

## Quick Start

```bash
# 1. Copy environment file
cp .env.docker.example .env.docker

# 2. Configure production variables (see Configuration section)
vim .env.docker

# 3. Pull latest images
docker compose -f docker-compose.prod.yaml pull

# 4. Start services
docker compose -f docker-compose.prod.yaml up -d

# 5. Run database migrations (required on first run)
cd packages/db
pnpm migrate

# 6. Deploy Tinybird local (optional, for analytics)
cd packages/tinybird
tb --local deploy

# 7. Verify deployment
docker compose -f docker-compose.prod.yaml ps
```

## Pre-built Images

All images are automatically built via GitHub Actions CI/CD and are available at `ghcr.io/aggmoulik/openstatus-*`:

**Build Triggers:**
- ✅ Pushes to any branch (builds and publishes)
- ✅ Pull requests (builds only, validates images work)
- ✅ Version tags (e.g., v1.2.3) (builds and publishes)
- ✅ Manual workflow dispatch

**Available Images:**

| Component | Image | Description |
|-----------|-------|-------------|
| Dashboard | `ghcr.io/aggmoulik/openstatus-dashboard` | Admin interface |
| Server | `ghcr.io/aggmoulik/openstatus-server` | tRPC API backend |
| Workflows | `ghcr.io/aggmoulik/openstatus-workflows` | Background jobs |
| Status Page | `ghcr.io/aggmoulik/openstatus-status-page` | Public status pages |
| Private Location | `ghcr.io/aggmoulik/openstatus-private-location` | Monitoring agent |

## Available Image Tags

Images are tagged with multiple strategies for flexibility:

### Version Tags (Recommended for Production)

```bash
# Specific version (most stable)
ghcr.io/aggmoulik/openstatus-dashboard:v1.2.3

# Minor version (automatic patch updates)
ghcr.io/aggmoulik/openstatus-dashboard:v1.2

# Major version (automatic minor/patch updates)
ghcr.io/aggmoulik/openstatus-dashboard:v1

# Latest stable release
ghcr.io/aggmoulik/openstatus-dashboard:latest
```

### Branch Tags (For Testing)

```bash
# Main branch (latest development)
ghcr.io/aggmoulik/openstatus-dashboard:main

# Feature branch
ghcr.io/aggmoulik/openstatus-dashboard:feature-branch-name

# Commit SHA
ghcr.io/aggmoulik/openstatus-dashboard:sha-abc1234
```

## Image Pinning Strategies

### Strategy 1: Specific Version (Recommended)

**Best for**: Production environments requiring maximum stability

```yaml
services:
  dashboard:
    image: ghcr.io/aggmoulik/openstatus-dashboard:v1.2.3
```

**Pros:**
- Predictable behavior
- Controlled updates
- Easy rollback

**Cons:**
- Manual updates required
- No automatic security patches

### Strategy 2: Minor Version

**Best for**: Production with automatic patch updates

```yaml
services:
  dashboard:
    image: ghcr.io/aggmoulik/openstatus-dashboard:v1.2
```

**Pros:**
- Automatic bug fixes
- Compatible updates only
- Balance of stability and updates

**Cons:**
- Slight unpredictability
- Requires periodic validation

### Strategy 3: Latest Tag

**Best for**: Development/staging environments

```yaml
services:
  dashboard:
    image: ghcr.io/aggmoulik/openstatus-dashboard:latest
```

**Pros:**
- Always up-to-date
- No manual intervention

**Cons:**
- Potential breaking changes
- Less predictable

## Production Configuration

### Required Environment Variables

Edit `.env.docker` with production values:

```bash
# Authentication (generate secure random string, minimum 32 characters)
AUTH_SECRET=your-production-secret-min-32-chars

# Database
DATABASE_URL=http://libsql:8080
DATABASE_AUTH_TOKEN=basic:token

# Email (get from resend.com)
RESEND_API_KEY=re_xxxxx

# Self-hosting flag
SELF_HOST=true
```

### Optional Production Services

```bash
# Redis (recommended for production)
UPSTASH_REDIS_REST_URL=https://your-redis.upstash.io
UPSTASH_REDIS_REST_TOKEN=your-token

# Analytics (optional)
TINY_BIRD_API_KEY=your-tinybird-key

# OAuth providers (optional)
AUTH_GITHUB_ID=your-github-oauth-id
AUTH_GITHUB_SECRET=your-github-oauth-secret
AUTH_GOOGLE_ID=your-google-oauth-id
AUTH_GOOGLE_SECRET=your-google-oauth-secret
```

### Public URLs

Update these based on your domain:

```bash
NEXT_PUBLIC_URL=https://your-domain.com
```

## Deployment Workflow

### Initial Deployment

```bash
# 1. Pull images
docker compose -f docker-compose.prod.yaml pull

# 2. Start external services first
docker compose -f docker-compose.prod.yaml up -d libsql tinybird-local

# 3. Wait for services to be healthy
docker compose -f docker-compose.prod.yaml ps

# 4. Run migrations
cd packages/db && pnpm migrate && cd ../..

# 5. Start OpenStatus services
docker compose -f docker-compose.prod.yaml up -d

# 6. Verify all services are healthy
docker compose -f docker-compose.prod.yaml ps
```

### Updating Images

```bash
# 1. Pull new images
docker compose -f docker-compose.prod.yaml pull

# 2. Restart services with zero downtime (one at a time)
docker compose -f docker-compose.prod.yaml up -d --no-deps workflows
docker compose -f docker-compose.prod.yaml up -d --no-deps server
docker compose -f docker-compose.prod.yaml up -d --no-deps private-location
docker compose -f docker-compose.prod.yaml up -d --no-deps dashboard
docker compose -f docker-compose.prod.yaml up -d --no-deps status-page

# 3. Verify services are healthy
docker compose -f docker-compose.prod.yaml ps
```

### Rolling Back

```bash
# Option 1: Rollback to specific version
# Edit docker-compose.prod.yaml to use previous version tag
vim docker-compose.prod.yaml
# Change: ghcr.io/aggmoulik/openstatus-dashboard:v1.2.3
# To:     ghcr.io/aggmoulik/openstatus-dashboard:v1.2.2

# Pull old version and restart
docker compose -f docker-compose.prod.yaml pull dashboard
docker compose -f docker-compose.prod.yaml up -d --no-deps dashboard

# Option 2: Use image digest (most reliable)
docker compose -f docker-compose.prod.yaml pull
docker images --digests | grep openstatus
# Use specific digest SHA256
docker tag ghcr.io/aggmoulik/openstatus-dashboard@sha256:abc123... ghcr.io/aggmoulik/openstatus-dashboard:rollback
```

## Monitoring and Maintenance

### Health Checks

All services have built-in health checks:

```bash
# View service health status
docker compose -f docker-compose.prod.yaml ps

# Check specific service health
docker inspect openstatus-dashboard --format='{{.State.Health.Status}}'
```

### Viewing Logs

```bash
# All services
docker compose -f docker-compose.prod.yaml logs -f

# Specific service
docker compose -f docker-compose.prod.yaml logs -f dashboard

# Last 100 lines
docker compose -f docker-compose.prod.yaml logs --tail=100 server
```

### Resource Usage

```bash
# Monitor resource usage
docker stats

# View disk usage
docker system df

# Clean up unused resources
docker system prune -a --volumes
```

## Backup and Recovery

### Database Backup

```bash
# Backup LibSQL database
docker compose -f docker-compose.prod.yaml exec libsql \
  tar czf - /var/lib/sqld > backup-$(date +%Y%m%d-%H%M%S).tar.gz

# Alternative: Copy database file
docker cp openstatus-libsql:/var/lib/sqld/data.sqld backup-$(date +%Y%m%d).sqld
```

### Restore Database

```bash
# Stop services
docker compose -f docker-compose.prod.yaml down

# Restore from backup
docker compose -f docker-compose.prod.yaml up -d libsql
docker cp backup-20240101.sqld openstatus-libsql:/var/lib/sqld/data.sqld
docker compose -f docker-compose.prod.yaml restart libsql

# Start services
docker compose -f docker-compose.prod.yaml up -d
```

## Security Best Practices

### 1. Use Specific Version Tags

Always pin to specific versions in production:

```yaml
# Good
image: ghcr.io/aggmoulik/openstatus-dashboard:v1.2.3

# Avoid in production
image: ghcr.io/aggmoulik/openstatus-dashboard:latest
```

### 2. Secure Secrets

Never commit `.env.docker` to version control:

```bash
# Add to .gitignore
echo ".env.docker" >> .gitignore
```

Use strong, randomly generated secrets:

```bash
# Generate secure AUTH_SECRET
openssl rand -base64 48
```

### 3. Network Security

Use Docker networks to isolate services:

```yaml
networks:
  openstatus:
    driver: bridge
    name: openstatus
```

### 4. Resource Limits

Add resource limits to prevent resource exhaustion:

```yaml
services:
  dashboard:
    image: ghcr.io/aggmoulik/openstatus-dashboard:v1.2.3
    deploy:
      resources:
        limits:
          cpus: '2.0'
          memory: 2G
        reservations:
          cpus: '1.0'
          memory: 1G
```

### 5. Regular Updates

Keep images updated for security patches:

```bash
# Check for updates weekly
docker compose -f docker-compose.prod.yaml pull
docker compose -f docker-compose.prod.yaml up -d
```

### 6. Read-only Root Filesystem

For enhanced security, use read-only root filesystem where possible:

```yaml
services:
  dashboard:
    image: ghcr.io/aggmoulik/openstatus-dashboard:v1.2.3
    read_only: true
    tmpfs:
      - /tmp
      - /app/.next/cache
```

## High Availability Setup

### Multiple Replicas

Scale services for high availability:

```bash
# Scale workflows for parallel job processing
docker compose -f docker-compose.prod.yaml up -d --scale workflows=3
```

### Load Balancing

Use a reverse proxy (Nginx, Traefik, Caddy):

```yaml
# Example Traefik labels
services:
  dashboard:
    labels:
      - "traefik.enable=true"
      - "traefik.http.routers.dashboard.rule=Host(`openstatus.yourdomain.com`)"
      - "traefik.http.services.dashboard.loadbalancer.server.port=3000"
```

## Troubleshooting

### Services Won't Start

```bash
# Check logs
docker compose -f docker-compose.prod.yaml logs

# Check service health
docker compose -f docker-compose.prod.yaml ps

# Recreate services
docker compose -f docker-compose.prod.yaml up -d --force-recreate
```

### Database Connection Issues

```bash
# Verify LibSQL is healthy
docker compose -f docker-compose.prod.yaml ps libsql

# Check LibSQL logs
docker compose -f docker-compose.prod.yaml logs libsql

# Test connection
curl http://localhost:8080/health
```

### Image Pull Failures

```bash
# Check if images exist
docker pull ghcr.io/aggmoulik/openstatus-dashboard:latest

# Use different tag
docker compose -f docker-compose.prod.yaml pull --ignore-pull-failures
```

## Performance Optimization

### Enable BuildKit Cache

Already enabled in CI/CD, images are optimized for size and speed.

### Use Volume Mounts for Data

Persistent data is stored in Docker volumes:

```bash
# List volumes
docker volume ls

# Backup volume
docker run --rm -v openstatus-libsql-data:/data -v $(pwd):/backup \
  alpine tar czf /backup/libsql-backup.tar.gz /data
```

## Getting Help

- **Documentation**: [docs.openstatus.dev](https://docs.openstatus.dev)
- **Discord**: [openstatus.dev/discord](https://www.openstatus.dev/discord)
- **GitHub Issues**: [github.com/openstatusHQ/openstatus/issues](https://github.com/openstatusHQ/openstatus/issues)
- **Docker Images**: [ghcr.io/aggmoulik](https://github.com/aggmoulik?tab=packages)

## Checklist

### Pre-Deployment

- [ ] Environment variables configured
- [ ] Database backup strategy in place
- [ ] Resource limits set
- [ ] Monitoring configured
- [ ] SSL/TLS certificates ready (if applicable)

### Post-Deployment

- [ ] All services healthy
- [ ] Database migrations complete
- [ ] Health checks passing
- [ ] Logs monitored
- [ ] Backups tested

### Ongoing Maintenance

- [ ] Weekly security updates
- [ ] Monthly database backups
- [ ] Quarterly disaster recovery tests
- [ ] Monitor resource usage
- [ ] Review logs for errors

