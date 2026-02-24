# libSQL Database for Railway Deployment
FROM ghcr.io/tursodatabase/libsql-server:latest

# Create non-root user
RUN addgroup -g 999 libsql && \
    adduser -u 999 -G libsql -s /bin/sh -D libsql

# Set environment variables
ENV SQLD_NODE=primary
ENV SQLD_HTTP_ADDRESS=0.0.0.0:8080
ENV SQLD_TCP_ADDRESS=0.0.0.0:5001
ENV SQLD_DATA_PATH=/var/lib/sqld

# Create directories
RUN mkdir -p /var/lib/sqld && \
    chown -R libsql:libsql /var/lib/sqld

# Copy health check script
COPY --chown=libsql:libsql <<'EOF' /usr/local/bin/healthcheck.sh
#!/bin/sh
# Health check for libSQL
# Test HTTP endpoint
wget --no-verbose --tries=1 --spider http://localhost:8080/ || exit 1
# Test TCP endpoint
timeout 5 bash -c "cat < /dev/null > /dev/tcp/localhost/5001" || exit 1
EOF

# Make health check script executable
RUN chmod +x /usr/local/bin/healthcheck.sh

# Switch to non-root user
USER libsql

# Expose ports
EXPOSE 8080 5001

# Health check
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
    CMD /usr/local/bin/healthcheck.sh

# Data volume
VOLUME ["/var/lib/sqld"]

# Start libSQL server
CMD ["sqld", "--http-address", "0.0.0.0:8080", "--tcp-address", "0.0.0.0:5001", "--data-path", "/var/lib/sqld"]
