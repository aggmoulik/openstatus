# Redis Cache for Railway Deployment
FROM redis:7-alpine

# Create non-root user
RUN addgroup -g 999 redis && \
    adduser -u 999 -G redis -s /bin/sh -D redis

# Set environment variables
ENV REDIS_PASSWORD_FILE=/run/secrets/redis-password
ENV REDIS_DATA_DIR=/data

# Create directories
RUN mkdir -p /run/secrets /data && \
    chown -R redis:redis /run/secrets /data

# Copy Redis configuration
COPY --chown=redis:redis <<'EOF' /usr/local/etc/redis/redis.conf
# Redis configuration for Railway
bind 0.0.0.0
port 6379
protected-mode yes
requirepassfile /run/secrets/redis-password
save 900 1
save 300 10
save 60 10000
rdbcompression yes
rdbchecksum yes
dbfilename dump.rdb
dir /data
maxmemory 256mb
maxmemory-policy allkeys-lru
EOF

# Copy health check script
COPY --chown=redis:redis <<'EOF' /usr/local/bin/healthcheck.sh
#!/bin/sh
# Health check for Redis
if [ -f "$REDIS_PASSWORD_FILE" ]; then
    REDIS_PASSWORD=$(cat "$REDIS_PASSWORD_FILE")
    redis-cli -a "$REDIS_PASSWORD" ping || exit 1
else
    redis-cli ping || exit 1
fi
EOF

# Make health check script executable
RUN chmod +x /usr/local/bin/healthcheck.sh

# Switch to non-root user
USER redis

# Expose port
EXPOSE 6379

# Health check
HEALTHCHECK --interval=30s --timeout=5s --start-period=5s --retries=3 \
    CMD /usr/local/bin/healthcheck.sh

# Data volume
VOLUME ["/data"]

# Start Redis
CMD ["redis-server", "/usr/local/etc/redis/redis.conf"]
