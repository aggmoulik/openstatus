# OpenStatus Workflows Dockerfile for Railway
FROM oven/bun:1.3.6-alpine AS base
WORKDIR /app

# Install dependencies
FROM base AS deps
COPY package.json bun.lockb ./
COPY apps/workflows/package.json ./apps/workflows/
COPY packages/db/package.json ./packages/db/
COPY packages/config/package.json ./packages/config/
RUN bun install --frozen-lockfile

# Build the application
FROM base AS builder
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN bun run build:workflows

# Production image
FROM base AS runner
WORKDIR /app

# Create non-root user
RUN addgroup --system --gid 1001 bun
RUN adduser --system --uid 1001 bun

# Copy built application
COPY --from=builder /app/apps/workflows/dist ./dist
COPY --from=builder /app/packages/db/dist ./packages/db/dist
COPY --from=builder /app/packages/config/dist ./packages/config/dist
COPY --from=builder /app/node_modules ./node_modules
COPY package.json bun.lockb ./

# Set permissions
RUN chown -R bun:bun /app
USER bun

# Start the application
CMD ["bun", "run", "start:workflows"]
