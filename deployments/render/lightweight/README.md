# OpenStatus Lightweight on Render

Deploy a minimal OpenStatus setup on Render with just the status page and dashboard.

## Overview

This deployment includes:
- **Dashboard & Status Page**: Combined interface for managing and displaying status
- **PostgreSQL Database**: Data persistence
- **Email Authentication**: Magic link login via Resend

Perfect for:
- Teams who only need status page functionality
- Manual incident management
- Simple communication tool
- Resource-constrained environments

## Quick Start

1. **One-Click Deployment**
   ```bash
   # Click the Render button in main README
   https://render.com/deploy?repo=https://github.com/openstatushq/openstatus&env=DEPLOYMENT_TYPE=lightweight
   ```

2. **Manual Setup**
   - Go to [Render Dashboard](https://dashboard.render.com)
   - Click "New +" → "Web Service"
   - Connect your forked repository
   - Select the `deployments/render/lightweight` directory
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
| OpenStatus App | `https://openstatus-app.onrender.com` | Dashboard & Status Page |
| Database | Internal | PostgreSQL |

## Configuration

### Required Environment Variables

- `AUTH_SECRET`: Authentication secret (generate with `openssl rand -base64 32`)
- `RESEND_API_KEY`: Email service API key from [Resend](https://resend.com)

### Optional Environment Variables

- `AUTH_GITHUB_ID`/`AUTH_GITHUB_SECRET`: GitHub OAuth
- `AUTH_GOOGLE_ID`/`AUTH_GOOGLE_SECRET`: Google OAuth

## Post-Deployment Setup

### 1. Access Your Application

Navigate to your app URL and sign up using email authentication.

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

### Health Checks

The application includes health checks:
- Application health: `/`
- Database connectivity

### Logs

Access logs in Render dashboard for your service.

### Metrics

Render provides basic metrics for:
- CPU usage
- Memory usage
- Network traffic
- Response times

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

- Database is a private service
- Only the web service is public
- Internal communication is secure

## Troubleshooting

### Common Issues

**Application won't start:**
- Check environment variables
- Review build logs
- Verify database connection

**Authentication issues:**
- Verify `AUTH_SECRET` is set
- Check email configuration
- Ensure proper OAuth setup

**Database errors:**
- Ensure database service is healthy
- Check connection string format
- Verify migration completion

### Getting Help

- [Render Documentation](https://render.com/docs)
- [OpenStatus Documentation](../../../../apps/docs/)
- [Discord Community](https://www.openstatus.dev/discord)

## Cost

### Render Free Tier

- Web Service: 750 hours/month
- Database: 256MB storage
- Perfect for small teams and personal projects

### Paid Plans

- Additional instances for scaling
- More storage for database
- Enhanced monitoring
- Priority support

## Next Steps

- [Configure custom domains](../docs/configuration.md#custom-domains)
- [Set up manual incident workflows](../docs/configuration.md#incident-workflows)
- [Customize status page themes](../docs/configuration.md#themes)
- [Upgrade to full stack](../full-stack/) when needed
