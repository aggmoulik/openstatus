# Deploy OpenStatus on Railway

This guide will help you deploy OpenStatus on Railway using our pre-configured templates.

## Prerequisites

- A [Railway account](https://railway.app)
- A GitHub account (for repository connection)
- Basic understanding of Docker and environment variables

## Quick Start

### Option 1: Full Stack Deployment

The full stack includes all OpenStatus services:
- Dashboard (admin interface)
- Status Page (public status pages)
- API Server (backend)
- Background Workflows (monitoring jobs)
- libSQL Database
- Redis Cache

**Steps:**

1. **Fork the Repository**
   ```bash
   # Fork https://github.com/openstatushq/openstatus to your GitHub account
   ```

2. **Connect to Railway**
   - Go to [Railway Dashboard](https://railway.app/new)
   - Click "Deploy from GitHub repo"
   - Select your forked repository
   - Choose the `railway` branch or main branch

3. **Configure Deployment**
   - Railway will detect the `railway.toml` configuration
   - Select the `deployments/railway/docker-compose.railway.yaml` file
   - Review the service definitions

4. **Set Environment Variables**
   Add these variables at the project level:
   ```bash
   # Required
   DATABASE_URL=http://libsql:8080
   AUTH_SECRET=your-32-character-secret-here
   SELF_HOST=true
   
   # Optional but recommended
   RESEND_API_KEY=your-resend-api-key
   NODE_ENV=production
   ```

5. **Deploy**
   - Click "Deploy Now"
   - Railway will build and deploy all services
   - Wait for all services to become healthy

### Option 2: Lightweight Deployment

The lightweight version includes only:
- Dashboard and Status Page
- libSQL Database

**Steps:**

1. **Follow steps 1-2 from Full Stack**

2. **Select Lightweight Configuration**
   - Choose `deployments/railway/lightweight/docker-compose.railway.yaml`
   - Review the simplified service definitions

3. **Set Environment Variables**
   ```bash
   # Required
   DATABASE_URL=http://libsql:8080
   AUTH_SECRET=your-32-character-secret-here
   SELF_HOST=true
   RESEND_API_KEY=your-resend-api-key
   NODE_ENV=production
   ```

4. **Deploy**
   - Click "Deploy Now"
   - Wait for deployment to complete

## Accessing Your Deployment

After deployment, Railway will provide URLs for each service:

### Full Stack
- **Dashboard**: `https://your-dashboard-production.up.railway.app`
- **Status Page**: `https://your-status-page-production.up.railway.app`
- **API**: `https://your-api-production.up.railway.app`

### Lightweight
- **Dashboard**: `https://your-dashboard-production.up.railway.app`
- **Status Page**: `https://your-status-page-production.up.railway.app`

## Post-Deployment Setup

### 1. Create Workspace Limits

After deployment, set up workspace limits:

```bash
# Get your workspace ID first
curl -X POST http://libsql-production.up.railway.app/ \
  -H "Content-Type: application/json" \
  -d '{"statements":["SELECT id, name FROM workspace"]}'

# Set limits (replace WORKSPACE_ID with your actual ID)
curl -X POST http://libsql-production.up.railway.app/ \
  -H "Content-Type: application/json" \
  -d '{"statements":["UPDATE workspace SET limits = '\''{\\"monitors\\":100,\\"periodicity\\":[\\"30s\\",\\"1m\\",\\"5m\\",\\"10m\\",\\"30m\\",\\"1h\\"],\\"multi-region\\":true,\\"data-retention\\":\\"24 months\\",\\"status-pages\\":20,\\"maintenance\\":true,\\"status-subscribers\\":true,\\"custom-domain\\":true,\\"password-protection\\":true,\\"white-label\\":true,\\"notifications\\":true,\\"sms\\":true,\\"pagerduty\\":true,\\"notification-channels\\":50,\\"members\\":\\"Unlimited\\",\\"audit-log\\":true,\\"private-locations\\":true}'\'' WHERE id = WORKSPACE_ID"]}'
```

### 2. Configure Custom Domains (Optional)

1. Go to your service settings in Railway
2. Click "Settings" → "Networking"
3. Add your custom domain
4. Update `NEXT_PUBLIC_URL` environment variable
5. Configure DNS records as instructed by Railway

### 3. Set Up Private Locations (Full Stack Only)

For monitoring capabilities, deploy private locations:

1. In your dashboard, go to **Settings → Private Locations**
2. Create a new private location
3. Copy the generated `OPENSTATUS_KEY`
4. Deploy the private location using our [Cloudflare Containers guide](../../../apps/docs/src/content/docs/guides/how-to-deploy-probes-cloudflare-containers.mdx)

## Environment Variables

### Required
- `DATABASE_URL`: Database connection string
- `AUTH_SECRET`: Authentication secret (32+ characters)
- `SELF_HOST`: Set to "true" for self-hosted mode

### Optional but Recommended
- `RESEND_API_KEY`: For email authentication
- `NODE_ENV`: Set to "production"

### Optional
- `AUTH_GITHUB_ID`/`AUTH_GITHUB_SECRET`: GitHub OAuth
- `AUTH_GOOGLE_ID`/`AUTH_GOOGLE_SECRET`: Google OAuth
- `TINY_BIRD_API_KEY`: Analytics (requires Tinybird setup)

## Railway-Specific Features

### Volumes

Railway automatically creates persistent volumes for your database:
- Database data persists across deployments
- Backups are handled by Railway
- Volume size can be adjusted in service settings

### Environment Groups

Use environment groups for different deployment stages:
- `production`: Production environment
- `staging`: Testing environment
- `development`: Development environment

### Health Checks

All services include health checks:
- Automatic restart on failure
- Health status visible in dashboard
- Customizable health check paths

## Monitoring and Logs

### Logs
- Real-time logs available in Railway dashboard
- Filter by service and time range
- Download logs for analysis

### Metrics
- Built-in metrics for CPU, memory, and network
- Custom metrics can be added
- Alerting available through integrations

### Integrations
- Slack notifications
- Discord notifications
- Custom webhooks

## Scaling

### Vertical Scaling
1. Go to service settings
2. Click "Settings" → "Scaling"
3. Adjust instance size

### Horizontal Scaling
1. Enable "Horizontal Scaling"
2. Set minimum and maximum instances
3. Railway handles load balancing

## Cost Optimization

### Free Tier Usage
- Monitor your usage in Railway dashboard
- Stay within free tier limits when possible
- Use lightweight version for smaller deployments

### Resource Optimization
- Right-size your instances
- Use environment-specific configurations
- Implement caching where possible

## Troubleshooting

### Common Issues

**Service won't start:**
- Check environment variables are set correctly
- Review build logs in Railway dashboard
- Ensure Docker compose syntax is valid

**Database connection errors:**
- Verify database service is healthy
- Check `DATABASE_URL` format
- Ensure proper service dependencies

**Authentication issues:**
- Verify `AUTH_SECRET` is set and long enough
- Check email configuration with Resend

### Getting Help

- Check [Railway documentation](https://docs.railway.app)
- Review our [troubleshooting guide](./troubleshooting.md)
- Join our [Discord community](https://www.openstatus.dev/discord)

## Advanced Configuration

### Custom Dockerfiles
You can customize the Dockerfiles for your specific needs:
- Add custom dependencies
- Optimize for your use case
- Implement custom build steps

### Service Dependencies
The docker-compose files define proper service dependencies:
- Database starts before applications
- Migrations run before application startup
- Services wait for dependencies to be healthy

### Environment-Specific Configs
Use different configurations for different environments:
- Development: Debug logging, relaxed security
- Staging: Production-like settings
- Production: Full security and optimization

## Next Steps

- [Configure custom domains](./configuration.md#custom-domains)
- [Set up monitoring and alerts](./configuration.md#monitoring)
- [Deploy private monitoring locations](../../../apps/docs/src/content/docs/guides/how-to-deploy-probes-cloudflare-containers.mdx)
- [Configure notifications](../../../apps/docs/src/content/docs/monitoring/customization/notification.md)
- [Set up CI/CD pipelines](./configuration.md#cicd)
