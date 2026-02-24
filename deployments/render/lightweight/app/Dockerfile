# OpenStatus Lightweight App Dockerfile for Render
# Combines dashboard and status page functionality

FROM node:20-alpine AS base

# Install dependencies only when needed
FROM base AS deps
RUN apk add --no-cache libc6-compat
WORKDIR /app

# Install dependencies
COPY package.json package-lock.json* ./
COPY apps/dashboard/package.json ./apps/dashboard/
COPY apps/status-page/package.json ./apps/status-page/
COPY packages/db/package.json ./packages/db/
COPY packages/config/package.json ./packages/config/
COPY packages/ui/package.json ./packages/ui/
COPY packages/react/package.json ./packages/react/
COPY packages/icons/package.json ./packages/icons/
COPY packages/theme-store/package.json ./packages/theme-store/
RUN npm ci

# Rebuild the source code only when needed
FROM base AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .

# Build both dashboard and status page
RUN npm run build:dashboard
RUN npm run build:status-page

# Production image
FROM base AS runner
WORKDIR /app

ENV NODE_ENV production

RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nextjs

COPY --from=builder /app/public ./public

# Set the correct permission for prerender cache
RUN mkdir .next
RUN chown nextjs:nodejs .next

# Copy dashboard build
COPY --from=builder --chown=nextjs:nodejs /app/apps/dashboard/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/apps/dashboard/.next/static ./.next/static

# Copy status page build
COPY --from=builder --chown=nextjs:nodejs /app/apps/status-page/.next/standalone ./status-page/
COPY --from=builder --chown=nextjs:nodejs /app/apps/status-page/.next/static ./status-page/.next/static

USER nextjs

EXPOSE 3000

ENV PORT 3000
ENV HOSTNAME "0.0.0.0"

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD curl -f http://localhost:3000/ || exit 1

CMD ["node", "server.js"]
