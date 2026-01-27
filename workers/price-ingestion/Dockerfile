# Price Ingestion Worker Dockerfile
FROM oven/bun:1.1-alpine AS base
WORKDIR /app

# Install dependencies
FROM base AS deps
COPY package.json bun.lockb ./
COPY workers/price-ingestion/package.json ./workers/price-ingestion/
COPY packages/db/package.json ./packages/db/
COPY packages/env/package.json ./packages/env/
RUN bun install --frozen-lockfile && rm -rf ~/.bun/install/cache

# Build stage
FROM base AS builder
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN cd packages/db && bunx prisma generate
RUN bun run build --filter=price-ingestion-worker

# Production stage
FROM base AS runner
WORKDIR /app
ENV NODE_ENV=production

COPY --from=deps /app/node_modules ./node_modules
COPY --from=builder /app/packages ./packages
COPY --from=builder /app/workers/price-ingestion ./workers/price-ingestion
COPY --from=builder /app/package.json ./

# Create non-root user
RUN addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 worker --ingroup nodejs
USER worker

CMD ["bun", "run", "--cwd", "workers/price-ingestion", "start"]
