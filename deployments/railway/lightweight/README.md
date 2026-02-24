# OpenStatus Lightweight on Railway

Deploy a minimal OpenStatus setup on Railway with just the status page and dashboard.

## Overview

This deployment includes:
- **Dashboard & Status Page**: Combined interface for managing and displaying status
- **libSQL Database**: Data persistence
- **Email Authentication**: Magic link login via Resend

Perfect for:
- Teams who only need status page functionality
- Manual incident management
- Simple communication tool
- Resource-constrained environments

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
   - Choose the `deployments/railway/lightweight/docker-compose.railway.yaml` file

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
   Click "Deploy Now" and wait for deployment to complete.

## Services

| Service | URL Pattern | Purpose |
|---------|-------------|---------|
| Dashboard | `https://your-dashboard-production.up.railway.app` | Admin interface |
| Status Page | `https://your-status-page-production.up.railway.app` | Public status pages |
| Database | Internal | libSQL |

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

## Railway-Specific Features

### Volumes

Railway automatically creates persistent volumes:
- Database data persists across deployments
- Automatic backups handled by Railway
- Configurable volume sizes

### Health Checks

Both services include health checks:
- Automatic restart on failure
- Health status visible in dashboard
- Customizable health check paths and timeouts

### Service Discovery

Services communicate using Railway's internal networking:
- Service names resolve automatically
- Internal communication is secure
- No need for hardcoded IPs

## Post-Deployment Setup

### 1. Access Your Applications

Navigate to your dashboard and status page URLs and sign up using email authentication.

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

### 3. Create Your First Status Page

1. In the dashboard, click "Status Pages"
2. Create a new status page
3. Add components for your services
4. Publish the status page

## Features

### What's Included

✅ **Status Page Management**
- Create and manage multiple status pages
- Custom themes and branding
- Component status tracking
- Incident management

✅ **Dashboard**
- Admin interface for managing status pages
- User management
- Workspace settings
- Incident reporting

✅ **Authentication**
- Email-based magic link authentication
- Optional OAuth (GitHub/Google)
- Multi-user support

✅ **Railway Benefits**
- Automatic SSL certificates
- Persistent storage
- Built-in monitoring
- Easy scaling

### What's Not Included

❌ **Automated Monitoring**
- No automatic uptime checks
- No synthetic monitoring
- No alert notifications

❌ **Analytics**
- No uptime statistics
- No performance metrics
- No historical data

❌ **Advanced Features**
- No private monitoring locations
- No multi-region checks
- No API access

## Use Cases

### Perfect For

- **Manual Status Communication**: Teams that want to manually update service status
- **Incident Communication**: Simple way to communicate during outages
- **Internal Status Pages**: Company-wide service status
- **Resource Constraints**: Limited budget or infrastructure
- **Quick Setup**: Teams needing fast deployment

### Not Suitable For

- **Automated Monitoring**: Teams needing automatic uptime checks
- **Alerting**: Teams requiring automatic notifications
- **Analytics**: Teams needing detailed metrics and insights

## Upgrading to Full Stack

If you later need automated monitoring, you can upgrade to the full stack:

1. Deploy the [full stack version](../full-stack/)
2. Export your data from lightweight version
3. Import data into full stack
4. Update DNS records if using custom domains

## Monitoring

### Built-in Monitoring

Railway provides:
- Real-time logs for both services
- CPU, memory, and network metrics
- Historical data and trends
- Custom alerting

### Service Health

Both services include health checks:
- Dashboard: `/`
- Status Page: `/`
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

- Database is a private service
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

**Application won't start:**
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
- Perfect for small projects and teams

### Paid Plans

- Additional hours for scaling
- More bandwidth and storage
- Enhanced monitoring
- Priority support
- Custom domains

## Next Steps

- [Configure custom domains](../docs/configuration.md#custom-domains)
- [Set up manual incident workflows](../docs/configuration.md#incident-workflows)
- [Customize status page themes](../docs/configuration.md#themes)
- [Set up monitoring and alerts](../docs/configuration.md#monitoring)
- [Upgrade to full stack](../full-stack/) when needed
