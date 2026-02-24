# OpenStatus Deployment Templates

This directory contains deployment templates for deploying OpenStatus on various platforms and environments.

## 🚀 One-Click Deployment

For the fastest deployment experience, use our one-click deployment buttons in the main [README.md](../README.md#one-click-deployment-):

- **Render**: Fully automated deployment with free tier
- **Railway**: Quick GitHub import with guided setup

## Quick Start

Choose your deployment platform:

### 🚀 Platform as a Service (PaaS)

#### [Render](./render/)
- **Full Stack**: Complete OpenStatus with monitoring
- **Lightweight**: Status page and dashboard only
- ✅ Free tier available
- ✅ Automatic SSL
- ✅ Built-in monitoring

#### [Railway](./railway/)
- **Full Stack**: Complete OpenStatus with monitoring
- **Lightweight**: Status page and dashboard only
- ✅ Generous free tier
- ✅ Docker Compose support
- ✅ Automatic deployments

### 🐳 Self-Hosted

#### [Docker Compose](../../docker-compose.yaml)
- **Full Stack**: All services included
- **Lightweight**: Status page only ([docker-compose-lightweight.yaml](../../docker-compose-lightweight.yaml))
- ✅ Complete control
- ✅ Customizable
- ✅ Works anywhere

## Deployment Options

### Full Stack vs Lightweight

| Feature | Full Stack | Lightweight |
|---------|------------|-------------|
| **Status Page** | ✅ Yes | ✅ Yes |
| **Dashboard** | ✅ Yes | ✅ Yes |
| **Automated Monitoring** | ✅ Yes | ❌ No |
| **Background Jobs** | ✅ Yes | ❌ No |
| **API Server** | ✅ Yes | ❌ No |
| **Analytics** | ✅ Yes | ❌ No |
| **Private Locations** | ✅ Yes | ❌ No |
| **Resource Usage** | Higher | Lower |
| **Setup Complexity** | Medium | Simple |

### Choose Full Stack if you need:
- Automated uptime monitoring
- Alert notifications
- Analytics and metrics
- API access
- Private monitoring locations

### Choose Lightweight if you need:
- Simple status page
- Manual incident management
- Resource efficiency
- Quick setup
- Basic functionality

## Platform Comparison

| Platform | Free Tier | Scaling | Ease of Use | Customization |
|----------|-----------|---------|--------------|---------------|
| **Render** | 750h/month | ✅ Vertical/Horizontal | ⭐⭐⭐⭐⭐ | ⭐⭐⭐ |
| **Railway** | 500h/month | ✅ Vertical/Horizontal | ⭐⭐⭐⭐ | ⭐⭐⭐⭐ |
| **Docker** | Unlimited | ✅ Full control | ⭐⭐⭐ | ⭐⭐⭐⭐⭐ |

## Getting Started

### 1. Choose Your Platform

Consider:
- **Budget**: Free tier availability
- **Technical expertise**: PaaS vs self-hosted
- **Scaling needs**: Current and future requirements
- **Control level**: How much customization you need

### 2. Follow Platform-Specific Guide

Each platform has detailed documentation:
- Step-by-step setup instructions
- Configuration guidance
- Troubleshooting tips
- Best practices

### 3. Configure Your Instance

Common setup steps:
- Set environment variables
- Create workspace limits
- Configure authentication
- Set up custom domains (optional)

### 4. Deploy Private Locations (Full Stack)

For monitoring capabilities:
- Create private location in dashboard
- Deploy monitoring probes
- Configure regions and checks

## Environment Variables

### Required for All Deployments

```bash
# Authentication
AUTH_SECRET=your-32-character-secret-here

# Database
DATABASE_URL=platform-specific-url

# Self-hosting
SELF_HOST=true

# Email (recommended)
RESEND_API_KEY=your-resend-api-key
```

### Optional Enhancements

```bash
# OAuth providers
AUTH_GITHUB_ID=your-github-id
AUTH_GITHUB_SECRET=your-github-secret
AUTH_GOOGLE_ID=your-google-id
AUTH_GOOGLE_SECRET=your-google-secret

# Analytics (full stack)
TINY_BIRD_API_KEY=your-tinybird-key
```

## Security Considerations

### Authentication
- Always set a strong `AUTH_SECRET`
- Use environment-specific secrets
- Enable email authentication
- Consider OAuth for production

### Network Security
- Use HTTPS (automatic on PaaS)
- Keep databases private
- Configure firewalls appropriately
- Monitor access logs

### Data Protection
- Regular backups
- Secure secret management
- Access control
- Compliance considerations

## Monitoring and Maintenance

### Health Checks
All deployments include health checks:
- Application endpoints
- Database connectivity
- Service dependencies

### Logging
- Platform-specific logging solutions
- Centralized log aggregation
- Error tracking
- Performance monitoring

### Updates
- Regular dependency updates
- Security patches
- Feature upgrades
- Migration planning

## Support

### Platform Support
- **Render**: [Render Documentation](https://render.com/docs)
- **Railway**: [Railway Documentation](https://docs.railway.app)
- **Docker**: [Docker Documentation](https://docs.docker.com)

### OpenStatus Support
- **Documentation**: [OpenStatus Docs](../../apps/docs/)
- **Community**: [Discord Server](https://www.openstatus.dev/discord)
- **Issues**: [GitHub Issues](https://github.com/openstatushq/openstatus/issues)
- **Discussions**: [GitHub Discussions](https://github.com/openstatushq/openstatus/discussions)

### Getting Help

When asking for help, include:
1. **Platform**: Render/Railway/Docker
2. **Deployment Type**: Full Stack/Lightweight
3. **Error Messages**: Full logs and stack traces
4. **Configuration**: Environment variables (sanitized)
5. **Steps to Reproduce**: Detailed reproduction steps

## Contributing

Want to add a new deployment template?

1. **Fork the repository**
2. **Create a new directory** under `deployments/`
3. **Add your template files**
4. **Write documentation**
5. **Submit a pull request**

### Template Requirements

- ✅ Step-by-step setup guide
- ✅ Environment variable documentation
- ✅ Troubleshooting section
- ✅ Security considerations
- ✅ Cost information
- ✅ Platform-specific features

## Roadmap

Upcoming deployment templates:

- [ ] **DigitalOcean App Platform**
- [ ] **AWS CloudFormation/CDK**
- [ ] **Google Cloud Run**
- [ ] **Azure Container Apps**
- [ ] **Kubernetes Helm Chart**
- [ ] **Terraform Modules**
- [ ] **Ansible Playbooks**

Stay tuned for more deployment options!

---

**Need help choosing?** Check out our [deployment guide](../../apps/docs/src/content/docs/guides/self-hosting-openstatus.mdx) for detailed comparisons and recommendations.
