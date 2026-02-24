# OpenStatus Full Stack on Render

Deploy the complete OpenStatus platform on Render with all services included.

## Overview

This deployment includes:
- **Dashboard**: Admin interface for managing monitors and status pages
- **Status Page**: Public-facing status pages for your users
- **API Server**: Backend API for all operations
- **Background Workflows**: Scheduled monitoring jobs and notifications
- **PostgreSQL Database**: Data persistence
- **Redis Cache**: Session storage and caching

## Quick Start

1. **Fork the Repository**
   ```bash
   git clone https://github.com/your-username/openstatus.git
   cd openstatus
   ```

2. **Deploy to Render**
   - Go to [Render Dashboard](https://dashboard.render.com)
   - Click "New +" → "Web Service"
   - Connect your forked repository
   - Select the `deployments/render/full-stack` directory
   - Render will automatically detect the `render.yaml` configuration

3. **Configure Environment Variables**
   Set these in your Render dashboard:
   ```bash
   AUTH_SECRET=your-32-character-secret-here
   RESEND_API_KEY=your-resend-api-key
   ```

4. **Deploy**
   Click "Create Web Service" and wait for deployment to complete.

## Services

| Service | URL | Purpose |
|---------|-----|---------|
| Dashboard | `https://openstatus-dashboard.onrender.com` | Admin interface |
| Status Page | `https://openstatus-status-page.onrender.com` | Public status pages |
| API Server | Internal | Backend API |
| Workflows | Internal | Background jobs |
| Database | Internal | PostgreSQL |
| Redis | Internal | Cache |

## Configuration

### Required Environment Variables

- `AUTH_SECRET`: Authentication secret (generate with `openssl rand -base64 32`)
- `RESEND_API_KEY`: Email service API key from [Resend](https://resend.com)

### Optional Environment Variables

- `AUTH_GITHUB_ID`/`AUTH_GITHUB_SECRET`: GitHub OAuth
- `AUTH_GOOGLE_ID`/`AUTH_GOOGLE_SECRET`: Google OAuth
- `TINY_BIRD_API_KEY`: Analytics (requires Tinybird setup)

## Post-Deployment Setup

### 1. Access Your Dashboard

Navigate to your dashboard URL and sign up using email authentication.

### 2. Set Workspace Limits

Run this command to set up workspace limits:

```bash
# Get your workspace ID first
curl -X POST https://openstatus-db.onrender.com/ \
  -H "Content-Type: application/json" \
  -d '{"statements":["SELECT id, name FROM workspace"]}'

# Set limits (replace WORKSPACE_ID)
curl -X POST https://openstatus-db.onrender.com/ \
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

### Health Checks

All services include health checks:
- Dashboard: `/`
- Status Page: `/`
- API Server: `/ping`
- Database: Built-in PostgreSQL health checks

### Logs

Access logs in Render dashboard for each service.

### Metrics

Render provides basic metrics for:
- CPU usage
- Memory usage
- Network traffic
- Response times

## Scaling

### Vertical Scaling

1. Go to service settings in Render
2. Click "Advanced"
3. Choose a more powerful instance type

### Horizontal Scaling

1. Enable "Auto-scaling" in service settings
2. Set minimum and maximum instances
3. Configure scaling thresholds

## Security

### SSL/TLS

Render automatically provides:
- Free SSL certificates
- Automatic HTTPS
- Certificate renewal

### Environment Variables

- All secrets are stored securely
- Use Render's secret management
- Never commit secrets to git

### Network Security

- Database and Redis are private services
- API server is private (internal only)
- Only dashboard and status page are public

## Troubleshooting

### Common Issues

**Service won't start:**
- Check environment variables
- Review build logs
- Verify service dependencies

**Database connection errors:**
- Ensure database service is healthy
- Check `DATABASE_URL` format
- Verify service dependencies

**Authentication issues:**
- Verify `AUTH_SECRET` is set
- Check email configuration
- Ensure proper OAuth setup

### Getting Help

- [Render Documentation](https://render.com/docs)
- [OpenStatus Documentation](../../../../apps/docs/)
- [Discord Community](https://www.openstatus.dev/discord)

## Cost

### Render Free Tier

- Dashboard: 750 hours/month
- Status Page: 750 hours/month
- Database: 256MB storage
- Redis: 256MB storage

### Paid Plans

- Additional instances for scaling
- More storage for database
- Enhanced monitoring
- Priority support

## Next Steps

- [Configure custom domains](../docs/configuration.md#custom-domains)
- [Set up monitoring alerts](../docs/configuration.md#monitoring)
- [Deploy private locations](../../../../apps/docs/src/content/docs/guides/how-to-deploy-probes-cloudflare-containers.mdx)
- [Configure notifications](../../../../apps/docs/src/content/docs/monitoring/customization/notification.md)
