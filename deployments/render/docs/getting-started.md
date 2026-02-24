# Deploy OpenStatus on Render

This guide will help you deploy OpenStatus on Render using our pre-configured templates.

## Prerequisites

- A [Render account](https://render.com)
- A GitHub account (for repository connection)
- Basic understanding of environment variables

## Quick Start

### Option 1: Full Stack Deployment

The full stack includes all OpenStatus services:
- Dashboard (admin interface)
- Status Page (public status pages)
- API Server (backend)
- Background Workflows (monitoring jobs)
- PostgreSQL Database
- Redis Cache

**Steps:**

1. **Fork the Repository**
   ```bash
   # Fork https://github.com/openstatushq/openstatus to your GitHub account
   ```

2. **Connect to Render**
   - Go to [Render Dashboard](https://dashboard.render.com)
   - Click "New +" → "Web Service"
   - Connect your forked repository
   - Select the `deployments/render/full-stack` directory

3. **Configure Services**
   - Render will automatically detect the `render.yaml` configuration
   - Review the service definitions and environment variables
   - Set required environment variables:
     - `AUTH_SECRET`: Generate with `openssl rand -base64 32`
     - `RESEND_API_KEY`: Get from [Resend](https://resend.com)

4. **Deploy**
   - Click "Create Web Service"
   - Render will build and deploy all services
   - Wait for all services to become healthy

### Option 2: Lightweight Deployment

The lightweight version includes only:
- Dashboard and Status Page (combined)
- PostgreSQL Database

**Steps:**

1. **Follow steps 1-2 from Full Stack**

2. **Select Lightweight Directory**
   - Choose the `deployments/render/lightweight` directory instead

3. **Configure Environment Variables**
   - `AUTH_SECRET`: Generate with `openssl rand -base64 32`
   - `RESEND_API_KEY`: Get from [Resend](https://resend.com)

4. **Deploy**
   - Click "Create Web Service"
   - Wait for deployment to complete

## Accessing Your Deployment

### Full Stack
- **Dashboard**: `https://openstatus-dashboard.onrender.com`
- **Status Page**: `https://openstatus-status-page.onrender.com`
- **API**: `https://openstatus-api.onrender.com` (private service)

### Lightweight
- **Dashboard & Status Page**: `https://openstatus-app.onrender.com`

## Post-Deployment Setup

### 1. Create Workspace Limits

After deployment, set up workspace limits by running:

```bash
# Get your workspace ID first
curl -X POST https://openstatus-db.onrender.com/ \
  -H "Content-Type: application/json" \
  -d '{"statements":["SELECT id, name FROM workspace"]}'

# Set limits (replace WORKSPACE_ID with your actual ID)
curl -X POST https://openstatus-db.onrender.com/ \
  -H "Content-Type: application/json" \
  -d '{"statements":["UPDATE workspace SET limits = '\''{\\"monitors\\":100,\\"periodicity\\":[\\"30s\\",\\"1m\\",\\"5m\\",\\"10m\\",\\"30m\\",\\"1h\\"],\\"multi-region\\":true,\\"data-retention\\":\\"24 months\\",\\"status-pages\\":20,\\"maintenance\\":true,\\"status-subscribers\\":true,\\"custom-domain\\":true,\\"password-protection\\":true,\\"white-label\\":true,\\"notifications\\":true,\\"sms\\":true,\\"pagerduty\\":true,\\"notification-channels\\":50,\\"members\\":\\"Unlimited\\",\\"audit-log\\":true,\\"private-locations\\":true}'\'' WHERE id = WORKSPACE_ID"]}'
```

### 2. Configure Custom Domains (Optional)

1. Go to your service settings in Render
2. Add your custom domain
3. Update `NEXT_PUBLIC_URL` environment variable
4. Configure DNS records as instructed by Render

### 3. Set Up Private Locations (Full Stack Only)

For monitoring capabilities, deploy private locations:

1. In your dashboard, go to **Settings → Private Locations**
2. Create a new private location
3. Copy the generated `OPENSTATUS_KEY`
4. Deploy the private location using our [Cloudflare Containers guide](../../../apps/docs/src/content/docs/guides/how-to-deploy-probes-cloudflare-containers.mdx)

## Environment Variables

### Required
- `AUTH_SECRET`: Authentication secret (32+ characters)
- `RESEND_API_KEY`: For email authentication

### Optional
- `AUTH_GITHUB_ID`/`AUTH_GITHUB_SECRET`: GitHub OAuth
- `AUTH_GOOGLE_ID`/`AUTH_GOOGLE_SECRET`: Google OAuth
- `TINY_BIRD_API_KEY`: Analytics (requires Tinybird setup)

## Monitoring and Logs

- **Logs**: Available in Render dashboard for each service
- **Metrics**: Render provides basic metrics and health checks
- **Alerts**: Configure alerts in Render settings

## Scaling

### Vertical Scaling
- Go to service settings → "Advanced"
- Adjust instance type and resources

### Horizontal Scaling
- Enable "Auto-scaling" in service settings
- Set min/max instances based on your needs

## Troubleshooting

### Common Issues

**Service won't start:**
- Check environment variables are set correctly
- Review build logs in Render dashboard
- Ensure all dependencies are properly installed

**Database connection errors:**
- Verify database service is healthy
- Check `DATABASE_URL` format
- Ensure proper service dependencies

**Authentication issues:**
- Verify `AUTH_SECRET` is set and long enough
- Check email configuration with Resend

### Getting Help

- Check [Render documentation](https://render.com/docs)
- Review our [troubleshooting guide](./troubleshooting.md)
- Join our [Discord community](https://www.openstatus.dev/discord)

## Next Steps

- [Configure custom domains](./configuration.md#custom-domains)
- [Set up SSL certificates](./configuration.md#ssl-setup)
- [Deploy private monitoring locations](../../../apps/docs/src/content/docs/guides/how-to-deploy-probes-cloudflare-containers.mdx)
- [Configure notifications](../../../apps/docs/src/content/docs/monitoring/customization/notification.md)
