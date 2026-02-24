# Railway Deployment Troubleshooting

This guide covers common issues and solutions when deploying OpenStatus on Railway.

## Service Deployment Issues

### Build Failures

**Issue: Build timeout**
```
Error: Build timed out after 20 minutes
```

**Solution:**
1. Check if your repository is large
2. Optimize Dockerfiles for faster builds
3. Use `.dockerignore` to exclude unnecessary files
4. Consider using Railway's build caching

**Issue: Docker build failed**
```
Error: failed to solve: process "/bin/sh -c" didn't complete
```

**Solution:**
1. Check Dockerfile syntax
2. Verify all dependencies are properly installed
3. Ensure base images are compatible
4. Review build logs for specific error details

### Runtime Errors

**Issue: Service crashes immediately**
```
Error: Service exited with code 1
```

**Solution:**
1. Check service logs in Railway dashboard
2. Verify environment variables are set correctly
3. Ensure proper port configuration
4. Check for missing dependencies

**Issue: Service not accessible**
```
Error: Service not responding
```

**Solution:**
1. Verify service is running (check logs)
2. Ensure proper port exposure
3. Check health check configuration
4. Verify network connectivity between services

## Docker Compose Issues

### Service Dependencies

**Issue: Services starting in wrong order**
```
Error: Database connection refused
```

**Solution:**
1. Check `depends_on` configuration
2. Verify health check conditions
3. Ensure proper service names in URLs
4. Add startup delays if needed

**Issue: Service communication failures**
```
Error: Connection refused between services
```

**Solution:**
1. Verify services are in same network
2. Check service names in connection strings
3. Ensure proper port mapping
4. Review network configuration

### Volume Issues

**Issue: Data not persisting**
```
Error: Database empty after restart
```

**Solution:**
1. Check volume configuration
2. Verify volume mount paths
3. Ensure proper permissions
4. Check Railway volume quotas

**Issue: Volume permission errors**
```
Error: Permission denied
```

**Solution:**
1. Check user permissions in Dockerfile
2. Ensure proper volume ownership
3. Use appropriate file permissions
4. Consider using named volumes

## Database Issues

### libSQL Connection Problems

**Issue: Database not starting**
```
Error: libsql server failed to start
```

**Solution:**
1. Check database service logs
2. Verify volume permissions
3. Ensure proper configuration
4. Restart database service

**Issue: Migration failures**
```
Error: Migration failed to apply
```

**Solution:**
1. Check migration scripts
2. Verify database connectivity
3. Run migrations manually:
   ```bash
   # Access service shell in Railway
   cd packages/db
   bun install
   bun run migrate
   ```
4. Check for schema conflicts

### Connection String Issues

**Issue: Invalid database URL**
```
Error: Invalid DATABASE_URL format
```

**Solution:**
1. Use Railway's internal service URLs
2. Follow proper URL format: `http://service-name:port`
3. Check for special characters in credentials
4. Verify service names match docker-compose

## Environment Variable Issues

### Missing Variables

**Issue: Required environment variable not found**
```
Error: AUTH_SECRET is required
```

**Solution:**
1. Check Railway environment variables tab
2. Verify variable names match exactly
3. Ensure variables are set at correct scope (project vs service)
4. Check for typos in variable names

### Invalid Values

**Issue: Invalid environment variable value**
```
Error: Invalid boolean value for SELF_HOST
```

**Solution:**
1. Use proper boolean values: "true" or "false"
2. Check for extra spaces or quotes
3. Verify URL formats are correct
4. Ensure proper escaping of special characters

## Authentication Problems

### Magic Link Issues

**Issue: Magic link emails not sending**
```
Error: Email service unavailable
```

**Solution:**
1. Verify `RESEND_API_KEY` is valid
2. Check Resend dashboard for API key status
3. Ensure sender domain is verified
4. Check email configuration

**Issue: Magic link verification fails**
```
Error: Invalid or expired token
```

**Solution:**
1. Check `AUTH_SECRET` consistency across services
2. Verify token expiration settings
3. Ensure system time synchronization
4. Check for secret rotation issues

### OAuth Configuration

**Issue: GitHub OAuth callback fails**
```
Error: redirect_uri mismatch
```

**Solution:**
1. Update GitHub OAuth app settings
2. Use Railway's provided callback URLs
3. Check environment variable configuration
4. Ensure proper URL encoding

## Performance Issues

### Slow Response Times

**Issue: Dashboard loading slowly**
```
Response time: >10 seconds
```

**Solution:**
1. Check resource allocation in Railway
2. Enable Redis caching if available
3. Optimize database queries
4. Consider upgrading instance size

**Issue: Memory usage high**
```
Error: Out of memory
```

**Solution:**
1. Monitor memory usage in Railway dashboard
2. Optimize application memory usage
3. Increase memory allocation
4. Check for memory leaks

### Scaling Issues

**Issue: Horizontal scaling not working**
```
Error: Multiple instances not starting
```

**Solution:**
1. Check scaling configuration
2. Ensure stateless application design
3. Verify session handling
4. Check database connection pooling

## Railway-Specific Issues

### Build Context Issues

**Issue: Build context too large**
```
Error: Build context larger than limit
```

**Solution:**
1. Create `.dockerignore` file
2. Exclude unnecessary files and directories
3. Optimize Docker build context
4. Use multi-stage builds

### Deployment Failures

**Issue: Deployment stuck**
```
Error: Deployment in progress for >30 minutes
```

**Solution:**
1. Cancel stuck deployment
2. Check build logs for errors
3. Restart deployment
4. Contact Railway support if persistent

### Service Discovery

**Issue: Services can't find each other**
```
Error: Service name resolution failed
```

**Solution:**
1. Verify services are in same project
2. Check docker-compose network configuration
3. Use Railway's internal service names
4. Ensure proper service naming

## Debugging Tools

### Railway Dashboard

**Accessing Logs:**
1. Go to Railway project
2. Click on problematic service
3. View real-time logs
4. Use search and filters

**Monitoring Metrics:**
1. Service settings → "Metrics"
2. View CPU, memory, network usage
3. Check historical data
4. Set up alerts

### Command Line Debugging

**Access Service Shell:**
```bash
# In Railway dashboard, click service → "More" → "Open Shell"
```

**Manual Health Checks:**
```bash
# Check API health
curl http://localhost:3000/ping

# Check database connection
curl -X POST http://libsql:8080/ \
  -H "Content-Type: application/json" \
  -d '{"statements":["SELECT 1"]}'

# Check service status
curl http://localhost:3000/
```

**Environment Variables Check:**
```bash
# List all environment variables
env | grep -E "(DATABASE|AUTH|SELF_HOST)"

# Check specific variable
echo $DATABASE_URL
```

## Common Error Patterns

### Database Migration Issues
```
# Pattern 1: Migration not found
Error: Migration file not found: 001_initial.sql

# Pattern 2: Migration already applied
Error: Migration 001_initial already applied

# Pattern 3: Migration syntax error
Error: SQL syntax error near "CREATE"
```

### Authentication Failures
```
# Pattern 1: Missing secret
Error: AUTH_SECRET environment variable is required

# Pattern 2: Invalid secret
Error: Invalid JWT secret provided

# Pattern 3: Token expired
Error: Token expired at 2024-01-01T12:00:00Z
```

### Network Issues
```
# Pattern 1: Connection refused
Error: connect ECONNREFUSED 127.0.0.1:5432

# Pattern 2: Timeout
Error: Connection timeout after 30 seconds

# Pattern 3: DNS resolution failed
Error: getaddrinfo ENOTFOUND service-name
```

## Getting Help

### Railway Support
- [Railway Documentation](https://docs.railway.app)
- [Railway Discord](https://discord.gg/railway)
- Support via Railway dashboard

### OpenStatus Support
- [Discord Community](https://www.openstatus.dev/discord)
- [GitHub Issues](https://github.com/openstatushq/openstatus/issues)
- [Documentation](../../../apps/docs/)

### Information to Include

When asking for help, include:

1. **Service Configuration**
   - Railway project URL (if public)
   - Service names and types
   - Environment variables (sanitized)

2. **Error Messages**
   - Full error messages
   - Stack traces
   - Log snippets

3. **Steps to Reproduce**
   - Detailed reproduction steps
   - Expected vs actual behavior
   - Recent changes

4. **Environment Details**
   - Railway plan (free/pro)
   - Instance types
   - Deployment region

## Prevention Tips

### Before Deployment
1. Test Docker compose locally
2. Validate environment variables
3. Check resource requirements
4. Review service dependencies

### During Deployment
1. Monitor build progress
2. Check service health
3. Verify connectivity
4. Test basic functionality

### After Deployment
1. Set up monitoring
2. Configure alerts
3. Regular backups
4. Performance optimization

### Best Practices
1. Use specific image tags
2. Implement proper error handling
3. Add comprehensive logging
4. Use health checks
5. Optimize for Railway's architecture
