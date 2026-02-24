# OpenStatus Lightweight on Render (Free Tier)

Deploy a minimal OpenStatus setup on Render's free tier with just the status page and dashboard.

> **⚠️ Free Tier Limitations**: This configuration is optimized for Render's free tier and has important limitations. See [Free Tier Considerations](#free-tier-considerations) below.

## Overview

This deployment includes:
- **Dashboard & Status Page**: Combined interface for managing and displaying status
- **PostgreSQL Database**: 1GB storage, expires in 30 days
- **Email Authentication**: Magic link login via Resend

Perfect for:
- **Testing and development**: Try OpenStatus without cost
- **Hobby projects**: Personal status pages and dashboards
- **Learning**: Experiment with the platform
- **Small projects**: Limited monitoring needs
- **Resource-constrained environments**

## ⚠️ Free Tier Considerations

### Database Limitations
- **Storage**: Limited to 1GB (may be insufficient for heavy usage)
- **Expiration**: Database expires after 30 days (data lost)
- **Maintenance**: Render may restart database at any time
- **Backups**: No automatic backups on free tier

### Service Limitations
- **Spin-down**: Services spin down after 15 minutes of inactivity
- **Performance**: Limited resources may affect performance
- **No Redis**: Not included in lightweight deployment (can be added if needed)
- **No Workers**: No background processing (not needed for lightweight)

### Usage Limits
- **750 hours/month**: Free instance hours limit
- **Bandwidth**: 100GB/month outbound bandwidth
- **Builds**: Limited build pipeline minutes
- **No horizontal scaling** on free tier

## Quick Start

1. **One-Click Deployment**
   ```bash
   # Click the Render button in main README
   https://render.com/deploy?repo=https://github.com/openstatushq/openstatus&env=DEPLOYMENT_TYPE=lightweight
   ```

2. **Manual Setup**
   ```bash
   # Fork the repository
   git clone https://github.com/your-username/openstatus.git
   cd openstatus
   
   # Deploy to Render
   # 1. Connect your GitHub account to Render
   # 2. Select the repository
   # 3. Choose the deployments/render/lightweight/render.yaml file
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
   ```

4. **Deploy**
   Click "Deploy Now" and wait for deployment to complete.

## Services

| Service | URL Pattern | Purpose | Free Tier Notes |
|---------|-------------|---------|----------------|
| Dashboard | `https://openstatus-dashboard.onrender.com` | Admin interface | Spins down after 15min idle |
| Database | Internal | PostgreSQL | 1GB, expires in 30 days |

## Configuration

### Required Environment Variables

- `AUTH_SECRET`: Authentication secret (generate with `openssl rand -base64 32`)
- `SELF_HOST`: Set to `"true"` for self-hosted mode
- `RESEND_API_KEY`: Email service API key from [Resend](https://resend.com)

### Optional Environment Variables

- `AUTH_GITHUB_ID`/`AUTH_GITHUB_SECRET`: GitHub OAuth
- `AUTH_GOOGLE_ID`/`AUTH_GOOGLE_SECRET`: Google OAuth

### Render-Specific Features

#### Free Tier Service Management
- **Health Checks**: Render automatically monitors all services
- **Service Dependencies**: Render manages startup order
- **SSL Certificates**: Automatic HTTPS for all web services
- **Spin-down Behavior**: Services sleep after 15 minutes of inactivity
- **Build Optimization**: Efficient Docker layer caching

#### Blueprint Configuration
The `render.yaml` uses Render's blueprint format:
- No manual `healthCheck` definitions needed
- No `dependsOn` configurations required
- Automatic service discovery and networking
- Optimized for Render's free tier

## Post-Deployment Setup

### 1. Access Your Applications

Navigate to your dashboard URL and sign up using email authentication.

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
  -d '{"limits": "{\"monitors\":5,\"periodicity\":[\"30s\",\"1m\",\"5m\",\"10m\",\"30m\",\"1h\"],\"multi-region\":false,\"data-retention\":\"7 days\",\"status-pages\":1,\"maintenance\":true,\"status-subscribers\":true,\"custom-domain\":false,\"password-protection\":false,\"white-label\":false,\"notifications\":false,\"sms\":false,\"pagerduty\":false,\"notification-channels\":2,\"members\":\"Unlimited\",\"audit-log\":false,\"private-locations\":false}"}'
```

### 3. Create Your First Status Page

1. In the dashboard, click "Status Pages"
2. Create a new status page
3. Add components for your services
4. Customize the appearance
5. Publish the status page

## Features

### What's Included (Free Tier)

✅ **Status Page Management**
- Single status page with custom themes
- Component status tracking
- Manual incident management
- Email notifications

✅ **Dashboard**
- Admin interface for managing status pages
- User management
- Workspace settings
- Incident reporting

✅ **Render Free Tier Benefits**
- Automatic SSL certificates
- Built-in monitoring and logging
- 750 free instance hours per month
- Easy to get started

### ⚠️ Free Tier Limitations

❌ **Automated Monitoring**
- No automated uptime checks
- No alert notifications
- Limited to manual incident management

❌ **Advanced Features**
- No private monitoring locations
- No multi-region monitoring
- No analytics or metrics
- No API access

❌ **Performance**
- Services spin down when idle
- Limited resources may affect performance
- No horizontal scaling
- No caching layer

❌ **Reliability**
- Database expires in 30 days
- No automatic backups
- Services may restart at any time
- Data loss on service restarts

## Scaling

### Free Tier Limitations

- **No Vertical Scaling**: Cannot upgrade instance types on free tier
- **No Horizontal Scaling**: Cannot add more instances
- **Fixed Resources**: Limited CPU and memory allocation
- **No Custom Plans**: Cannot create custom instance types

### Upgrading to Paid Plans

To overcome free tier limitations:

1. **Go to Render Dashboard**
2. **Select your service**
3. **Click "Settings" → "Scaling"**
4. **Choose a paid instance type**
5. **Add payment method** if required

### Benefits of Upgrading

- **No spin-down**: Services stay always active
- **More Resources**: Better performance
- **Horizontal Scaling**: Multiple instances
- **Automatic backups**: Database backups
- **Advanced Features**: All monitoring features enabled

## Security

### Built-in Security

- **SSL/TLS**: Automatic HTTPS for all services
- **Isolation**: Services run in isolated environments
- **Secrets Management**: Secure environment variable storage
- **Network Security**: Internal services not exposed to internet

### Free Tier Security Considerations

- **Data Persistence**: Database expires in 30 days
- **Service Availability**: Services spin down when idle
- **Resource Limits**: Limited attack surface due to resource constraints
- **Backup Strategy**: Manual backups required for data protection

### Best Practices

- Use strong `AUTH_SECRET` values
- Enable OAuth authentication
- Regularly export data before database expiration
- Monitor usage to avoid hitting limits
- Consider upgrading for production use

## Troubleshooting

### Common Free Tier Issues

**Service spins down frequently:**
- This is expected behavior on free tier
- Services spin down after 15 minutes of inactivity
- First request after spin-up may be slow

**Database expired:**
- Free databases expire after 30 days
- Upgrade to paid instance type to preserve data
- Export data before expiration

**Performance issues:**
- Free tier has limited resources
- Services may be slow during high traffic
- Consider upgrading for better performance

**Build failures:**
- Check if you've exceeded build pipeline minutes
- Verify repository size and dependencies
- Consider optimizing Dockerfiles

### Getting Help

- [Render Documentation](https://render.com/docs)
- [Render Status Page](https://status.render.com)
- [OpenStatus Documentation](../../../../apps/docs/)
- [OpenStatus Discord](https://www.openstatus.dev/discord)

## Cost

### Render Free Tier

- **750 hours/month** of service time
- **100GB** of egress bandwidth
- **1GB** database storage
- **No credit card required** for free tier

### Paid Plans

- **Additional hours** for scaling
- **More bandwidth** and storage
- **Enhanced monitoring** and logging
- **Priority support**
- **Custom domains**
- **Automatic backups**

### Cost Optimization

- **Use lightweight deployment**: Status page only uses fewer resources
- **Monitor usage**: Track your free tier consumption
- **Optimize builds**: Reduce build times and complexity
- **Consider upgrading**: For production or heavy usage

## Next Steps

- [Configure custom domains](../docs/configuration.md#custom-domains)
- [Set up manual monitoring](../docs/manual-monitoring.md)
- [Configure notification channels](../docs/notifications.md)
- [Upgrade to paid tier](https://render.com/docs/billing) when ready
- [Deploy full stack version](../full-stack/) when ready

## Support

- **Render Support**: [support@render.com](mailto:support@render.com)
- **OpenStatus Discord**: [Join our community](https://www.openstatus.dev/discord)
- **GitHub Issues**: [Report bugs](https://github.com/openstatushq/openstatus/issues)
- **Documentation**: [Full docs](../../../../apps/docs/) when needed
