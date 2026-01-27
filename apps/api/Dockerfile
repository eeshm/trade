# API Server Dockerfile
FROM oven/bun:1.1-alpine AS base
WORKDIR /app

# Install dependencies first (better layer caching)
FROM base AS deps
COPY package.json bun.lockb ./
COPY apps/api/package.json ./apps/api/
COPY packages/db/package.json ./packages/db/
COPY packages/auth/package.json ./packages/auth/
COPY packages/trading/package.json ./packages/trading/
COPY packages/env/package.json ./packages/env/
RUN bun install --frozen-lockfile && rm -rf ~/.bun/install/cache

# Build stage
FROM base AS builder
COPY --from=deps /app/node_modules ./node_modules
COPY . .

# Generate Prisma client and build
RUN cd packages/db && bunx prisma generate
RUN bun run build --filter=api

# Production stage - minimal image
FROM base AS runner
WORKDIR /app
ENV NODE_ENV=production

# Copy only production dependencies
COPY --from=deps /app/node_modules ./node_modules

# Copy built application
COPY --from=builder /app/packages ./packages
COPY --from=builder /app/apps/api/dist ./apps/api/dist
COPY --from=builder /app/apps/api/package.json ./apps/api/
COPY --from=builder /app/package.json ./

# Create non-root user for security
RUN addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 api --ingroup nodejs
USER api

EXPOSE 3000

# Health check for container orchestration
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:3000/health || exit 1

CMD ["bun", "run", "--cwd", "apps/api", "start"]
