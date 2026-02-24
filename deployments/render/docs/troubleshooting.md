# Render Deployment Troubleshooting

This guide covers common issues and solutions when deploying OpenStatus on Render.

## Service Deployment Issues

### Build Failures

**Issue: Build timeout**
```
Error: Build timed out after 15 minutes
```

**Solution:**
1. Check if your repository is large (consider `.dockerignore`)
2. Verify all dependencies are properly listed
3. Try reducing build complexity by optimizing Dockerfiles

**Issue: Dependency installation failed**
```
Error: npm ci failed
```

**Solution:**
1. Ensure `package-lock.json` is committed to repository
2. Check for platform-specific dependencies
3. Verify Node.js version compatibility

### Runtime Errors

**Issue: Service crashes on startup**
```
Error: Port 3000 already in use
```

**Solution:**
1. Check if multiple services are using the same port
2. Verify `PORT` environment variable is set correctly
3. Ensure proper service isolation

**Issue: Database connection refused**
```
Error: connect ECONNREFUSED 127.0.0.1:5432
```

**Solution:**
1. Verify database service is healthy
2. Check `DATABASE_URL` uses correct service name
3. Ensure proper service dependencies in `render.yaml`

## Database Issues

### Migration Failures

**Issue: Database migration not running**
```
Error: Relation "workspace" does not exist
```

**Solution:**
1. Check if `db-migrate` service completed successfully
2. Verify migration files exist in `packages/db`
3. Run migrations manually:
   ```bash
   # Access service shell in Render dashboard
   cd packages/db
   bun install
   bun run migrate
   ```

**Issue: Migration stuck in loop**
```
Error: Migration already applied
```

**Solution:**
1. Check migration status in database
2. Reset migration state if needed
3. Ensure migration scripts are idempotent

### Connection Issues

**Issue: Can't connect to database**
```
Error: too many connections
```

**Solution:**
1. Check database connection limits
2. Implement connection pooling
3. Verify proper connection closure

## Authentication Problems

### Magic Link Issues

**Issue: Magic link emails not arriving**
```
Error: Email sending failed
```

**Solution:**
1. Verify `RESEND_API_KEY` is valid
2. Check email configuration in Resend dashboard
3. Ensure sender domain is verified

**Issue: Magic link expired**
```
Error: Invalid or expired token
```

**Solution:**
1. Check `AUTH_SECRET` is consistent across services
2. Verify token expiration settings
3. Ensure system time is synchronized

### OAuth Issues

**Issue: GitHub OAuth callback fails**
```
Error: redirect_uri mismatch
```

**Solution:**
1. Update GitHub OAuth app callback URL
2. Use Render's provided URL format
3. Check environment variable configuration

## Performance Issues

### Slow Response Times

**Issue: Dashboard loads slowly**
```
Response time: >5 seconds
```

**Solution:**
1. Check resource allocation in service settings
2. Enable caching with Redis
3. Optimize database queries
4. Consider vertical scaling

**Issue: Status page performance**
```
Error: Request timeout
```

**Solution:**
1. Implement static generation where possible
2. Use CDN for static assets
3. Optimize database queries
4. Enable gzip compression

### Memory Issues

**Issue: Out of memory errors**
```
Error: JavaScript heap out of memory
```

**Solution:**
1. Increase memory allocation in service settings
2. Optimize memory usage in code
3. Implement proper garbage collection
4. Check for memory leaks

## Environment Variable Issues

### Missing Variables

**Issue: Required environment variable not set**
```
Error: AUTH_SECRET is required
```

**Solution:**
1. Check all required variables in documentation
2. Verify variable names match exactly
3. Ensure proper escaping of special characters

### Invalid Values

**Issue: Invalid database URL format**
```
Error: Invalid DATABASE_URL format
```

**Solution:**
1. Use Render's internal service URLs
2. Follow proper URL format: `postgresql://user:pass@host:port/db`
3. URL encode special characters

## SSL and HTTPS Issues

### Certificate Problems

**Issue: SSL certificate not trusted**
```
Error: SSL certificate verify failed
```

**Solution:**
1. Wait for automatic certificate provisioning
2. Check custom domain DNS configuration
3. Verify certificate chain completeness

### Mixed Content Issues

**Issue: Mixed content warnings**
```
Error: Mixed content: page loaded over HTTPS but requested HTTP
```

**Solution:**
1. Update all URLs to use HTTPS
2. Configure `NEXT_PUBLIC_URL` with HTTPS
3. Ensure all assets are served over HTTPS

## Debugging Tools

### Logs

**Accessing Logs:**
1. Go to Render dashboard
2. Select the problematic service
3. Click "Logs" tab
4. Use filters to find relevant entries

**Useful Log Commands:**
```bash
# Filter by error level
level:error

# Filter by service
service:openstatus-api

# Filter by time range
after:2024-01-01T00:00:00Z
```

### Health Checks

**Manual Health Check:**
```bash
# Check API health
curl https://your-service.onrender.com/ping

# Check dashboard health
curl https://your-service.onrender.com/

# Check database connection
curl -X POST https://your-db-service.onrender.com/ \
  -H "Content-Type: application/json" \
  -d '{"statements":["SELECT 1"]}'
```

### Debug Mode

**Enable Debug Logging:**
```bash
# Add to environment variables
DEBUG=*
LOG_LEVEL=debug
```

## Getting Help

### Render Support
- [Render Documentation](https://render.com/docs)
- [Render Status Page](https://status.render.com)
- Render support via dashboard

### OpenStatus Support
- [Discord Community](https://www.openstatus.dev/discord)
- [GitHub Issues](https://github.com/openstatushq/openstatus/issues)
- [Documentation](../../../apps/docs/)

### Information to Include When Asking for Help

1. **Service URLs** (sanitized if needed)
2. **Error messages** (full stack traces)
3. **Environment variables** (sanitized)
4. **Steps to reproduce**
5. **Expected vs actual behavior**

## Prevention Tips

### Before Deployment
1. Test locally with same environment variables
2. Validate Dockerfile syntax
3. Check service dependencies
4. Review resource requirements

### After Deployment
1. Set up monitoring and alerts
2. Regular backup of database
3. Keep dependencies updated
4. Monitor resource usage

### Best Practices
1. Use specific image tags instead of `latest`
2. Implement proper error handling
3. Add comprehensive logging
4. Set up health checks for all services
5. Use environment-specific configurations
