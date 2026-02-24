# PostgreSQL Database for Render Deployment
FROM postgres:15-alpine

# Create non-root user
RUN addgroup -g 999 postgres && \
    adduser -u 999 -G postgres -s /bin/sh -D postgres

# Set environment variables
ENV POSTGRES_DB=openstatus
ENV POSTGRES_USER=openstatus
ENV POSTGRES_PASSWORD_FILE=/run/secrets/postgres-password
ENV PGDATA=/var/lib/postgresql/data

# Create directories
RUN mkdir -p /run/secrets /var/lib/postgresql/data && \
    chown -R postgres:postgres /run/secrets /var/lib/postgresql/data

# Copy health check script
COPY --chown=postgres:postgres <<'EOF' /usr/local/bin/healthcheck.sh
#!/bin/sh
# Health check for PostgreSQL
pg_isready -U "${POSTGRES_USER}" -d "${POSTGRES_DB}" -h localhost -p 5432
EOF

# Make health check script executable
RUN chmod +x /usr/local/bin/healthcheck.sh

# Switch to non-root user
USER postgres

# Expose port
EXPOSE 5432

# Health check
HEALTHCHECK --interval=30s --timeout=5s --start-period=5s --retries=3 \
    CMD /usr/local/bin/healthcheck.sh

# Data volume
VOLUME ["/var/lib/postgresql/data"]

# Start PostgreSQL
CMD ["postgres", "-c", "config_file=/etc/postgresql/postgresql.conf", "-c", "listen_addresses=*"]
