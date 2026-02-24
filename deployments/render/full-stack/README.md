# OpenStatus Full Stack on Render

Deploy the complete OpenStatus platform with automated monitoring, alerts, and analytics on Render.

## Overview

This deployment includes:
- **Dashboard & Status Page**: Complete web interfaces
- **API Server**: REST API for all operations
- **Background Workflows**: Automated monitoring and alerting
- **PostgreSQL Database**: Data persistence
- **Redis Cache**: Performance optimization

Perfect for:
- Production monitoring setups
- Teams needing automated alerts
- Complete status page solution
- Analytics and reporting

## Quick Start

1. **One-Click Deployment**
   ```bash
   # Click the Render button in main README
   https://render.com/deploy?repo=https://github.com/openstatushq/openstatus
   ```

2. **Manual Setup**
   ```bash
   # Fork the repository
   git clone https://github.com/your-username/openstatus.git
   cd openstatus
   
   # Deploy to Render
   # 1. Connect your GitHub account to Render
   # 2. Select the repository
   # 3. Choose the render.yaml file
   # 4. Configure environment variables
   ```

3. **Configure Environment Variables**
   Add these to your Render project:
   ```bash
   # Required
   AUTH_SECRET=your-32-character-secret-here
   SELF_HOST=true
   RESEND_API_KEY=your-resend-api-key
   
   # Optional
   AUTH_GITHUB_ID=your-github-oauth-id
   AUTH_GITHUB_SECRET=your-github-oauth-secret
   AUTH_GOOGLE_ID=your-google-oauth-id
   AUTH_GOOGLE_SECRET=your-google-oauth-secret
   TINY_BIRD_API_KEY=your-tinybird-api-key
   ```

4. **Deploy**
   Click "Deploy Now" and wait for deployment to complete.

## Services

| Service | URL Pattern | Purpose |
|---------|-------------|---------|
| Dashboard | `https://openstatus-dashboard.onrender.com` | Admin interface |
| Status Page | `https://openstatus-status-page.onrender.com` | Public status pages |
| API Server | Private service | REST API |
| Workflows | Private service | Background jobs |
| Database | Internal | PostgreSQL |
| Redis | Internal | Cache |

## Configuration

### Required Environment Variables

- `AUTH_SECRET`: Authentication secret (generate with `openssl rand -base64 32`)
- `SELF_HOST`: Set to `"true"` for self-hosted mode
- `RESEND_API_KEY`: Email service API key from [Resend](https://resend.com)

### Optional Environment Variables

- `AUTH_GITHUB_ID`/`AUTH_GITHUB_SECRET`: GitHub OAuth
- `AUTH_GOOGLE_ID`/`AUTH_GOOGLE_SECRET`: Google OAuth
- `TINY_BIRD_API_KEY`: Analytics and charts
- `STRIPE_SECRET_KEY`: Payment processing
- `UNKEY_API_ID`: API key management

### Render-Specific Features

#### Automatic Service Management
- **Health Checks**: Render automatically monitors all services
- **Service Dependencies**: Render manages startup order
- **SSL Certificates**: Automatic HTTPS for all web services
- **Build Optimization**: Efficient Docker layer caching

#### Blueprint Configuration
The `render.yaml` uses Render's blueprint format:
- No manual `healthCheck` definitions needed
- No `dependsOn` configurations required
- Automatic service discovery and networking
- Optimized for Render's infrastructure

## Post-Deployment Setup

### 1. Access Your Applications

Navigate to your dashboard and status page URLs and sign up using email authentication.

### 2. Set Workspace Limits

Run this command to set up workspace limits:

```bash
# Get your workspace ID first
curl -X POST https://openstatus-dashboard.onrender.com/api/workspaces \
  -H "Content-Type: application/json" \
  -d '{"name":"My Workspace"}'

# Set limits (replace WORKSPACE_ID)
curl -X PATCH https://openstatus-dashboard.onrender.com/api/workspaces/WORKSPACE_ID \
  -H "Content-Type: application/json" \
  -d '{"limits": "{\"monitors\":100,\"periodicity\":[\"30s\",\"1m\",\"5m\",\"10m\",\"30m\",\"1h\"],\"multi-region\":true,\"data-retention\":\"24 months\",\"status-pages\":20,\"maintenance\":true,\"status-subscribers\":true,\"custom-domain\":true,\"password-protection\":true,\"white-label\":true,\"notifications\":true,\"sms\":true,\"pagerduty\":true,\"notification-channels\":50,\"members\":\"Unlimited\",\"audit-log\":true,\"private-locations\":true}"}'
```

### 3. Create Your First Monitor

1. In the dashboard, click "Monitors"
2. Create a new monitor for your website or API
3. Configure check frequency and regions
4. Set up notification channels

### 4. Create Status Pages

1. In the dashboard, click "Status Pages"
2. Create a new status page
3. Add components for your services
4. Customize the appearance
5. Publish the status page

## Features

### What's Included

✅ **Complete Monitoring**
- Automated uptime checks
- Multi-region monitoring
- Performance metrics
- Alert notifications

✅ **Status Page Management**
- Multiple status pages
- Custom themes and branding
- Component status tracking
- Incident management

✅ **Dashboard & Analytics**
- Real-time monitoring dashboard
- Historical data and trends
- Performance analytics
- User management

✅ **Background Processing**
- Automated monitoring workflows
- Alert processing
- Data aggregation
- Report generation

✅ **Render Benefits**
- Automatic SSL certificates
- Built-in monitoring and logging
- Easy scaling
- Managed database and Redis

### Advanced Features

- **Private Locations**: Deploy monitoring probes globally
- **Custom Notifications**: Slack, Discord, email, SMS
- **API Access**: Complete REST API for automation
- **Webhooks**: Real-time event notifications
- **Custom Domains**: Use your own domains for status pages

## Scaling

### Vertical Scaling

1. Go to service settings in Render dashboard
2. Click "Settings" → "Scaling"
3. Choose a more powerful instance type

### Horizontal Scaling

1. Enable "Horizontal Scaling" for web services
2. Set minimum and maximum instances
3. Configure scaling thresholds
4. Render handles load balancing automatically

### Database Scaling

1. Go to database service settings
2. Upgrade to larger instance type
3. Adjust disk size as needed
4. Render handles migration automatically

## Security

### Built-in Security

- **SSL/TLS**: Automatic HTTPS for all services
- **Isolation**: Services run in isolated environments
- **Secrets Management**: Secure environment variable storage
- **Network Security**: Internal services not exposed to internet

### Best Practices

- Use strong `AUTH_SECRET` values
- Enable OAuth authentication
- Regularly update dependencies
- Monitor Render's security advisories
- Use Render's built-in backup features

## Troubleshooting

### Common Issues

**Service won't start:**
- Check environment variables in Render dashboard
- Review build logs for each service
- Verify service dependencies (Render handles automatically)
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

### Render-Specific Issues

**Blueprint validation errors:**
- Ensure `render.yaml` follows Render's format
- Remove unsupported fields (`healthCheck`, `dependsOn`)
- Check image format (no quotes needed)
- Validate YAML syntax

**Build timeouts:**
- Optimize Dockerfiles for faster builds
- Use `.dockerignore` to exclude unnecessary files
- Consider reducing build complexity
- Check for large dependencies

### Getting Help

- [Render Documentation](https://render.com/docs)
- [Render Status Page](https://status.render.com)
- [OpenStatus Documentation](../../../../apps/docs/)
- [OpenStatus Discord](https://www.openstatus.dev/discord)

## Cost

### Render Free Tier

- **750 hours/month** of service time
- **100GB** of egress bandwidth
- **1GB** of storage
- Perfect for small projects and teams

### Paid Plans

- **Additional hours** for scaling
- **More bandwidth** and storage
- **Enhanced monitoring** and logging
- **Priority support**
- **Custom domains**

### Cost Optimization

- Use lightweight deployment for status page only
- Scale services independently based on needs
- Optimize build times with proper Dockerfiles
- Monitor resource usage in Render dashboard

## Next Steps

- [Configure custom domains](../docs/configuration.md#custom-domains)
- [Set up private monitoring locations](../docs/private-locations.md)
- [Configure notification channels](../docs/notifications.md)
- [Set up API access](../docs/api.md)
- [Deploy lightweight version](../lightweight/) for status page only

## Support

- **Render Support**: [support@render.com](mailto:support@render.com)
- **OpenStatus Discord**: [Join our community](https://www.openstatus.dev/discord)
- **GitHub Issues**: [Report bugs](https://github.com/openstatushq/openstatus/issues)
- **Documentation**: [Full docs](../../../../apps/docs/)
