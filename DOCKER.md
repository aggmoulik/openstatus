# Docker Setup Guide

Complete guide for running OpenStatus with Docker

## Deployment Options

OpenStatus can be deployed in two ways:

1. **Production/Self-Hosting** (Recommended) - Use pre-built images from GHCR
   - ✅ No build time required (save 15-30 minutes)
   - ✅ Faster updates with `docker compose pull`
   - ✅ Tested images from CI/CD
   - 📖 See: [DOCKER_PRODUCTION.md](DOCKER_PRODUCTION.md)

2. **Local Development** - Build from source
   - 🔧 Make code changes and test locally
   - 🔧 Full control over build process
   - 📖 Continue below for setup

## Quick Start - Production (Pre-built Images)

```bash
# 1. Copy environment file
cp .env.docker.example .env.docker

# 2. Configure required variables (see Configuration section)
vim .env.docker

# 3. Pull and start services
docker compose -f docker-compose.prod.yaml pull
docker compose -f docker-compose.prod.yaml up -d

# 4. Run database migrations (required)
cd packages/db
pnpm migrate

# 5. Access the application
open http://localhost:3002  # Dashboard
open http://localhost:3003  # Status Pages
```

📖 **Full production guide**: [DOCKER_PRODUCTION.md](DOCKER_PRODUCTION.md)

## Quick Start - Local Development

```bash
# 1. Copy environment file
cp .env.docker.example .env.docker

# 2. Configure required variables (see Configuration section)
vim .env.docker

# 3. Build and start services
export DOCKER_BUILDKIT=1
docker compose up -d

# 4. Check service health
docker compose ps

# 5. Run database migrations (required)
cd packages/db
pnpm migrate

# 6. Deploy Tinybird local
cd packages/tinybird
tb --local deploy 

# 7. Seed database with test data (optional)
cd packages/db
pnpm seed


# 8. Access the application
open http://localhost:3002  # Dashboard
open http://localhost:3003  # Status Pages
```

## Cleanup

```bash
# Remove stopped containers
docker compose down

# Remove volumes
docker compose down -v

# Clean build cache
docker builder prune
```

## Services

| Service | Port | Purpose |
|---------|------|---------|
| workflows | 3000 | Background jobs |
| server | 3001 | API backend (tRPC) |
| dashboard | 3002 | Admin interface |
| status-page | 3003 | Public status pages |
| private-location | 8081 | Monitoring agent |
| libsql | 8080 | Database (HTTP) |
| libsql | 5001 | Database (gRPC) |
| tinybird-local | 7181 | Analytics |


## Pre-built Docker Images

Pre-built images are automatically built and published via CI/CD to GitHub Container Registry.

### Available Images

All images are available at `ghcr.io/aggmoulik/openstatus-*`:

| Component | Image | Size |
|-----------|-------|------|
| Dashboard | `ghcr.io/aggmoulik/openstatus-dashboard` | ~500MB |
| Server | `ghcr.io/aggmoulik/openstatus-server` | ~100MB |
| Workflows | `ghcr.io/aggmoulik/openstatus-workflows` | ~150MB |
| Status Page | `ghcr.io/aggmoulik/openstatus-status-page` | ~500MB |
| Private Location | `ghcr.io/aggmoulik/openstatus-private-location` | ~30MB |

### Image Tags

```bash
# Latest stable release
:latest

# Specific version (recommended for production)
:v1.2.3
:v1.2
:v1

# Development branches
:main
:feature-branch

# Commit SHA
:sha-abc1234
```

### Using Pre-built Images

**Quick update workflow:**

```bash
# Pull latest images
docker compose -f docker-compose.prod.yaml pull

# Restart services
docker compose -f docker-compose.prod.yaml up -d

# Verify health
docker compose -f docker-compose.prod.yaml ps
```

📖 **Production deployment guide**: [DOCKER_PRODUCTION.md](DOCKER_PRODUCTION.md)

## Architecture

```
┌─────────────┐     ┌─────────────┐
│  Dashboard  │────▶│   Server    │
│  (Next.js)  │     │   (Bun)     │
└─────────────┘     └─────────────┘
      │                    │
      ▼                    ▼
┌─────────────┐     ┌─────────────┐
│ Status Page │     │  Workflows  │
│  (Next.js)  │     │   (Bun)     │
└─────────────┘     └─────────────┘
      │                    │
      └────────┬───────────┘
               ▼
        ┌─────────────┐
        │   LibSQL    │
        │  (Database) │
        └─────────────┘
```

## Database Setup

The LibSQL container starts with an empty database. You must run migrations before using the application:

```bash
cd packages/db
pnpm migrate
```

### Seeding Test Data (Optional)

For development, you can populate the database with sample data:

```bash
cd packages/db
pnpm seed
```

This creates:
- 3 workspaces (`love-openstatus`, `test2`, `test3`)
- 5 sample monitors and 1 status page
- Test user account: `ping@openstatus.dev`
- Sample incidents, status reports, and maintenance windows

**Accessing Seeded Data:**

To view the seeded data in the dashboard, you must log in using the seeded test email:

1. Navigate to http://localhost:3002/login
2. Use magic link authentication with email: `ping@openstatus.dev`
3. Check your console/logs for the magic link
4. After logging in, you'll be in the `love-openstatus` workspace with all seeded data

**If you use a different email address**, the system will create a new empty workspace for you. To access seeded data with a different account:

1. Add your user to the seeded workspace using SQL:
   ```bash
   # First, find your user_id
   curl -X POST http://localhost:8080/ -H "Content-Type: application/json" \
     -d '{"statements":["SELECT id, email FROM user"]}'

   # Then add association (replace USER_ID with your id)
   curl -X POST http://localhost:8080/ -H "Content-Type: application/json" \
     -d '{"statements":["INSERT INTO users_to_workspaces (user_id, workspace_id, role) VALUES (USER_ID, 1, '\''owner'\'')"]}'
   ```

2. Switch to the `love-openstatus` workspace using the workspace switcher in the dashboard sidebar

## Tinybird Setup (Optional)

Tinybird is used for analytics and monitoring metrics. The application will work without it, but analytics features will be unavailable.

If you want to enable analytics, you can:
1. Use Tinybird Cloud and configure `TINY_BIRD_API_KEY` in `.env.docker`
2. Manually configure Tinybird Local (requires additional setup beyond this guide)

## Configuration

### Required Environment Variables

Edit `.env.docker` and set:

```bash
# Authentication
AUTH_SECRET=your-secret-here

# Database
DATABASE_URL=http://libsql:8080
DATABASE_AUTH_TOKEN=basic:token

# Email
RESEND_API_KEY=test
```

### Optional Services

Configure these for full functionality:

```bash
# Redis
UPSTASH_REDIS_REST_URL=
UPSTASH_REDIS_REST_TOKEN=

# Analytics
TINY_BIRD_API_KEY=

# OAuth providers
AUTH_GITHUB_ID=
AUTH_GITHUB_SECRET=
AUTH_GOOGLE_ID=
AUTH_GOOGLE_SECRET=
```

See [.env.docker.example](.env.docker.example) for complete list.

## Development Workflow

### Common Commands

**For local development (building from source):**

```bash
# View logs
docker compose logs -f [service-name]

# Restart service
docker compose restart [service-name]

# Rebuild after code changes
docker compose up -d --build [service-name]

# Stop all services
docker compose down

# Reset database (removes all data)
docker compose down -v
# After resetting, re-run migrations:
# cd packages/db && pnpm migrate
```

**For production (using pre-built images):**

```bash
# Update to latest images
docker compose -f docker-compose.prod.yaml pull

# Restart services with new images
docker compose -f docker-compose.prod.yaml up -d

# View logs
docker compose -f docker-compose.prod.yaml logs -f [service-name]

# Stop all services
docker compose -f docker-compose.prod.yaml down
```

### Authentication

**Magic Link**:

Set `SELF_HOST=true` in `.env.docker` to enable email-based magic link authentication. This allows users to sign in without configuring OAuth providers.

**OAuth Providers**:

Configure GitHub/Google OAuth credentials in `.env.docker` and set up callback URLs:
  - GitHub: `http://localhost:3002/api/auth/callback/github`
  - Google: `http://localhost:3002/api/auth/callback/google`

### Creating Status Pages

**Via Dashboard (Recommended)**:
1. Login to http://localhost:3002
2. Create a workspace
3. Create a status page with a slug
4. Access at http://localhost:3003/[slug]

**Via Database (Testing)**:
```bash
# Insert test data
curl -s http://localhost:8080/v2/pipeline \
  -H 'Content-Type: application/json' \
  --data-raw '{
    "requests":[{
      "type":"execute",
      "stmt":{
        "sql":"INSERT INTO workspace (id, slug, name) VALUES (1, '\''test'\'', '\''Test Workspace'\'');"
      }
    }]
  }'
```

### Resource Limits

Add to `docker-compose.yaml`:

```yaml
services:
  dashboard:
    deploy:
      resources:
        limits:
          cpus: '1.0'
          memory: 1G
        reservations:
          cpus: '0.5'
          memory: 512M
```

## Monitoring

### Health Checks

All services have automated health checks:

```bash
# View health status
docker compose ps

# Inspect specific service
docker inspect openstatus-dashboard --format='{{.State.Health.Status}}'
```

## Getting Help

- **Documentation**: [docs.openstatus.dev](https://docs.openstatus.dev)
- **Discord**: [openstatus.dev/discord](https://www.openstatus.dev/discord)
- **GitHub Issues**: [github.com/openstatusHQ/openstatus/issues](https://github.com/openstatusHQ/openstatus/issues)
