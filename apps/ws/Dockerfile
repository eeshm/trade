# WebSocket Server Dockerfile
FROM oven/bun:1.1-alpine AS base
WORKDIR /app

# Install dependencies first (better layer caching)
FROM base AS deps
COPY package.json bun.lockb ./
COPY apps/ws/package.json ./apps/ws/
COPY packages/db/package.json ./packages/db/
COPY packages/env/package.json ./packages/env/
RUN bun install --frozen-lockfile && rm -rf ~/.bun/install/cache

# Build stage
FROM base AS builder
COPY --from=deps /app/node_modules ./node_modules
COPY . .

# Generate Prisma client and build
RUN cd packages/db && bunx prisma generate
RUN bun run build --filter=ws

# Production stage - minimal image
FROM base AS runner
WORKDIR /app
ENV NODE_ENV=production

# Copy only production dependencies
COPY --from=deps /app/node_modules ./node_modules

# Copy built application
COPY --from=builder /app/packages ./packages
COPY --from=builder /app/apps/ws/dist ./apps/ws/dist
COPY --from=builder /app/apps/ws/package.json ./apps/ws/
COPY --from=builder /app/package.json ./

# Create non-root user for security
RUN addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 ws --ingroup nodejs
USER ws

EXPOSE 3001

# Health check - WebSocket servers respond to HTTP upgrade requests
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:3001/ || exit 1

CMD ["bun", "run", "--cwd", "apps/ws", "start"]
