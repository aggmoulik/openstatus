# OpenStatus Full Stack on Railway

Deploy the complete OpenStatus platform on Railway with all services included.

## Overview

This deployment includes:
- **Dashboard**: Admin interface for managing monitors and status pages
- **Status Page**: Public-facing status pages for your users
- **API Server**: Backend API for all operations
- **Background Workflows**: Scheduled monitoring jobs and notifications
- **libSQL Database**: Data persistence
- **Redis Cache**: Session storage and caching

## Quick Start

1. **Fork the Repository**
   ```bash
   git clone https://github.com/your-username/openstatus.git
   cd openstatus
   ```

2. **Deploy to Railway**
   - Go to [Railway Dashboard](https://railway.app/new)
   - Click "Deploy from GitHub repo"
   - Select your forked repository
   - Choose the `deployments/railway/docker-compose.railway.yaml` file

3. **Configure Environment Variables**
   Add these to your Railway project:
   ```bash
   DATABASE_URL=http://libsql:8080
   AUTH_SECRET=your-32-character-secret-here
   SELF_HOST=true
   RESEND_API_KEY=your-resend-api-key
   NODE_ENV=production
   ```

4. **Deploy**
   Click "Deploy Now" and wait for all services to become healthy.

## Services

| Service | URL Pattern | Purpose |
|---------|-------------|---------|
| Dashboard | `https://your-dashboard-production.up.railway.app` | Admin interface |
| Status Page | `https://your-status-page-production.up.railway.app` | Public status pages |
| API Server | `https://your-api-production.up.railway.app` | Backend API |
| Workflows | Internal | Background jobs |
| Database | Internal | libSQL |
| Redis | Internal | Cache |

## Configuration

### Required Environment Variables

- `DATABASE_URL`: Database connection string (`http://libsql:8080`)
- `AUTH_SECRET`: Authentication secret (generate with `openssl rand -base64 32`)
- `SELF_HOST`: Set to `"true"` for self-hosted mode
- `RESEND_API_KEY`: Email service API key from [Resend](https://resend.com)
- `NODE_ENV`: Set to `"production"`

### Optional Environment Variables

- `AUTH_GITHUB_ID`/`AUTH_GITHUB_SECRET`: GitHub OAuth
- `AUTH_GOOGLE_ID`/`AUTH_GOOGLE_SECRET`: Google OAuth
- `TINY_BIRD_API_KEY`: Analytics (requires Tinybird setup)

## Railway-Specific Features

### Volumes

Railway automatically creates persistent volumes:
- Database data persists across deployments
- Automatic backups handled by Railway
- Configurable volume sizes

### Health Checks

All services include comprehensive health checks:
- Automatic restart on failure
- Health status visible in dashboard
- Customizable health check paths and timeouts

### Service Discovery

Services communicate using Railway's internal networking:
- Service names resolve automatically
- Internal communication is secure
- No need for hardcoded IPs

## Post-Deployment Setup

### 1. Access Your Dashboard

Navigate to your dashboard URL and sign up using email authentication.

### 2. Set Workspace Limits

Run this command to set up workspace limits:

```bash
# Get your workspace ID first
curl -X POST http://libsql-production.up.railway.app/ \
  -H "Content-Type: application/json" \
  -d '{"statements":["SELECT id, name FROM workspace"]}'

# Set limits (replace WORKSPACE_ID)
curl -X POST http://libsql-production.up.railway.app/ \
  -H "Content-Type: application/json" \
  -d '{"statements":["UPDATE workspace SET limits = '\''{\\"monitors\\":100,\\"periodicity\\":[\\"30s\\",\\"1m\\",\\"5m\\",\\"10m\\",\\"30m\\",\\"1h\\"],\\"multi-region\\":true,\\"data-retention\\":\\"24 months\\",\\"status-pages\\":20,\\"maintenance\\":true,\\"status-subscribers\\":true,\\"custom-domain\\":true,\\"password-protection\\":true,\\"white-label\\":true,\\"notifications\\":true,\\"sms\\":true,\\"pagerduty\\":true,\\"notification-channels\\":50,\\"members\\":\\"Unlimited\\",\\"audit-log\\":true,\\"private-locations\\":true}'\'' WHERE id = WORKSPACE_ID"]}'
```

### 3. Deploy Private Locations

For monitoring capabilities:

1. Go to **Settings → Private Locations** in your dashboard
2. Create a new private location
3. Copy the `OPENSTATUS_KEY`
4. Deploy private location using [Cloudflare Containers guide](../../../../apps/docs/src/content/docs/guides/how-to-deploy-probes-cloudflare-containers.mdx)

## Monitoring

### Built-in Monitoring

Railway provides:
- Real-time logs for all services
- CPU, memory, and network metrics
- Historical data and trends
- Custom alerting

### Service Health

All services include health checks:
- Dashboard: `/`
- Status Page: `/`
- API Server: `/ping`
- Database: Built-in libSQL health checks

### Integrations

Connect to external monitoring:
- Slack notifications
- Discord notifications
- Custom webhooks
- Email alerts

## Scaling

### Vertical Scaling

1. Go to service settings in Railway
2. Click "Settings" → "Scaling"
3. Choose a more powerful instance type

### Horizontal Scaling

1. Enable "Horizontal Scaling"
2. Set minimum and maximum instances
3. Configure scaling thresholds
4. Railway handles load balancing

### Cost Optimization

- Monitor resource usage in dashboard
- Right-size instances based on actual usage
- Use environment groups for different stages
- Take advantage of Railway's free tier

## Security

### SSL/TLS

Railway automatically provides:
- Free SSL certificates
- Automatic HTTPS
- Certificate renewal
- Custom domain support

### Environment Variables

- All secrets are encrypted at rest
- Use Railway's secret management
- Environment-specific configurations
- Never commit secrets to git

### Network Security

- Database and Redis are private services
- Internal communication is secure
- Service isolation
- Automatic network segmentation

## Development Workflow

### Environment Groups

Use different environments:
- `production`: Live environment
- `staging`: Testing environment
- `development`: Development environment

### CI/CD Integration

Railway works with:
- GitHub Actions
- GitLab CI
- Custom webhooks
- Automatic deployments on push

### Preview Deployments

Test changes before production:
- Automatic preview environments
- Pull request previews
- Isolated testing
- One-click promotion

## Troubleshooting

### Common Issues

**Service won't start:**
- Check environment variables in Railway dashboard
- Review build logs for each service
- Verify service dependencies in docker-compose
- Check resource allocation

**Database connection errors:**
- Ensure database service is healthy
- Check `DATABASE_URL` format
- Verify service names in connection strings
- Check network connectivity

**Authentication issues:**
- Verify `AUTH_SECRET` is set consistently
- Check email configuration with Resend
- Ensure proper OAuth setup
- Check service communication

### Railway-Specific Issues

**Build context too large:**
- Optimize `.dockerignore` file
- Exclude unnecessary files
- Use multi-stage builds
- Minimize layer sizes

**Service discovery failures:**
- Verify services are in same project
- Check docker-compose network configuration
- Use proper service names
- Ensure proper service naming

### Getting Help

- [Railway Documentation](https://docs.railway.app)
- [Railway Discord](https://discord.gg/railway)
- [OpenStatus Documentation](../../../../apps/docs/)
- [OpenStatus Discord](https://www.openstatus.dev/discord)

## Cost

### Railway Free Tier

- 500 hours/month of service time
- 100GB of egress bandwidth
- 1GB of storage
- Perfect for small projects

### Paid Plans

- Additional hours for scaling
- More bandwidth and storage
- Enhanced monitoring
- Priority support
- Custom domains

## Next Steps

- [Configure custom domains](../docs/configuration.md#custom-domains)
- [Set up monitoring and alerts](../docs/configuration.md#monitoring)
- [Deploy private locations](../../../../apps/docs/src/content/docs/guides/how-to-deploy-probes-cloudflare-containers.mdx)
- [Configure notifications](../../../../apps/docs/src/content/docs/monitoring/customization/notification.md)
- [Set up CI/CD pipelines](../docs/configuration.md#cicd)
