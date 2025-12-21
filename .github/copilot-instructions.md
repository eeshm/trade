# Solana Paper Trading Platform — Copilot Guidance

## Quick Reference

**This is a production-grade trading backend, not a demo.** Architectural discipline is non-negotiable.

### Key Principle
- **Wallet = Identity only** (not funds, not balance)
- All funds/balances are virtual, stored in Postgres
- Signing used for auth, never for spending

---

## Development Workflow

### Build & Run
```bash
turbo run build           # Build all packages
turbo run dev             # Start all dev servers
turbo run check-types     # Type check
turbo run lint            # Lint all
```

### Database Workflow
```bash
bun run migrate:dev       # Create/apply migrations (in @repo/db)
bun run migrate:deploy    # Deploy migrations (production)
bunx prisma studio       # Visual database explorer
```

### Infrastructure
```
Redis:     localhost:6379 (REDIS_URL in .env)
Postgres:  localhost:5432 (DATABASE_URL in .env)
API:       localhost:3000 (apps/api)
WebSocket: localhost:3001 (apps/ws, planned)
```

---

## Architecture Essentials (Enforce These)

### Ownership Rules (Critical)
| Layer | Owner | Rule |
|-------|-------|------|
| **Transport** | `apps/api`, `apps/ws` | HTTP/WS only, no logic |
| **Business Logic** | `packages/*` | Pure functions, no Express/Redis imports |
| **Database** | `@repo/db` only | Singleton PrismaClient, all DB access here |
| **Caching/Pub/Sub** | `@repo/redis` only | All Redis access here |
| **Auth** | `@repo/auth` | Wallet signing, session verification |
| **Trading** | `@repo/trading` | Order execution, position math |

**NEVER violate these boundaries.** No app may instantiate its own DB or Redis client.

### Pattern: Infrastructure Layer

All infrastructure packages follow the **singleton + health check** pattern:

```typescript
// @repo/db example (FOLLOW THIS PATTERN)
let prisma: PrismaClient | null = null;

export const initDb = async () => {
  prisma = new PrismaClient({...});
  await prisma.$queryRaw`SELECT 1`; // Fail fast
};

export const getDb = () => {
  if (!prisma) throw new Error('Not initialized');
  return prisma;
};

export const checkDbHealth = async () => { /* ... */ };
export const shutdownDb = async () => { /* ... */ };
```

Apply the same to `@repo/redis`: `initRedis()`, `getRedis()`, `isRedisHealthy()`.

### API Layer Structure (apps/api)

```
apps/api/src/
├── index.ts              # App creation, server startup
├── middlewares/          # Express middleware (logging, errors, auth)
├── routes/               # HTTP endpoints (route definitions only)
├── controllers/          # Request handling (parse → delegate → respond)
└── services/             # Business logic (import from @repo/*)
```

**Rule**: Routes call Controllers, Controllers call Domain Services.  
Controllers never touch DB—they call functions exported from `@repo/db`.

### Example Flow: Place Order
```
POST /orders (Express route)
  ↓ router → controller
  ↓ validate request
  ↓ import { executeOrder } from '@repo/trading'
  ↓ executeOrder(userId, orderData)
    ↓ reads from @repo/db (balance check)
    ↓ reads from Redis (price)
    ↓ executes db.$transaction() (atomic order + balance update)
    ↓ publishes to Redis pub/sub (broadcast to WS)
  ↓ controller returns response
```

---

## Infrastructure Implementation Status

### ✅ Done
- **@repo/db**: Prisma + PostgreSQL, migrations, singleton client
- **@repo/env**: Zod schema validation, centralized env config
- **@repo/redis**: Client, health checks, key management (keys.ts)
- **apps/api**: Express setup, /health endpoint, middleware pattern

### 🚧 In Progress
- **@repo/auth**: Wallet signature verification (TODO)
- **@repo/trading**: Order execution engine (TODO)
- **apps/ws**: WebSocket gateway (TODO)

### ❌ Not Started
- **@repo/pricing**: Price normalization
- **@repo/portfolio**: P&L calculations
- **workers/price-ingestion**: Market data ingestion

---

## Common Patterns

### Accessing Infrastructure
```typescript
// ✅ CORRECT: Inside a domain package
import { getDb } from '@repo/db';
import { client as redis } from '@repo/redis';

export const getUserBalance = async (userId: string) => {
  const db = getDb();
  return await db.portfolio.findUnique({ where: { userId } });
};

// ❌ WRONG: Creating your own client
import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient(); // VIOLATION
```

### Health Checks (for /health endpoint)
```typescript
import { checkDbHealth } from '@repo/db';
import { isRedisHealthy } from '@repo/redis';

const [db, redis] = await Promise.all([
  checkDbHealth(),
  isRedisHealthy(),
]);
if (!db.ok || !redis.ok) return res.status(503).json({...});
```

### Fail-Fast Startup
```typescript
// apps/api/src/index.ts - MUST follow this
await initDb();     // Throws if Postgres down
await initRedis();  // Throws if Redis down
// Only then listen for traffic
app.listen(port, () => console.log(`Listening on ${port}`));
```

---

## Data Flow & Critical Rules

### Order Execution (Atomic)
1. Validate user session (from Redis or @repo/auth)
2. Read user balance (Postgres)
3. Read price (Redis cache, fail if stale)
4. Calculate cost + fees
5. **Atomic transaction**:
   ```typescript
   await db.$transaction(async (tx) => {
     // Check balance
     const balance = await tx.portfolio.findUnique({...});
     if (balance.cash < cost) throw new Error('Insufficient funds');
     
     // Create order + update balance atomically
     await tx.order.create({...});
     await tx.portfolio.update({...});
   });
   ```
6. Publish event to Redis (triggers WebSocket broadcast)
7. Return response

**Why atomic?** Two concurrent orders can't double-spend the same balance.

### Real-Time Broadcasting (Price Updates)
```
Market data received
  ↓ parse price
  ↓ write to Redis (cache key: `price:SOL`)
  ↓ publish to Redis channel (`prices:SOL`)
    ↓ all connected WS clients subscribed to `prices:SOL` get update instantly
    ↓ no polling, no database hit
```

Redis Pub/Sub is the **fan-out backbone**. It's not optional.

---

## Testing & Debugging

### Check Infrastructure Health
```bash
# Postgres
bunx prisma studio   # Visual DB explorer

# Redis
redis-cli
> PING
> KEYS *              # See all keys
> GET price:SOL      # Check specific key
```

### Logging
```typescript
// Use environment-aware logging
console.log(process.env.NODE_ENV);  // Check if development/production
```

### Turbo Graph
```bash
turbo run build --graph   # Visualize dependency graph
```

---

## When Adding New Features

**Checklist:**
1. Does it touch infrastructure (DB/Redis)? → Add to @repo/db or @repo/redis
2. Does it have business logic? → Create @repo/new-domain package
3. Does an app need this? → Export from domain package, import in app
4. Does it need a database table? → Update prisma/schema.prisma, then `bun run migrate:dev`
5. Is there cross-app communication? → Use Redis Pub/Sub
6. Does it fail gracefully? → Add health check, fail fast on startup

---

## Critical Files to Review
- [prisma/schema.prisma](prisma/schema.prisma) — Database schema
- [packages/db/README.md](packages/db/README.md) — DB patterns
- [packages/db/src/index.ts](packages/db/src/index.ts) — Singleton pattern
- [apps/api/src/index.ts](apps/api/src/index.ts) — Startup flow
- [turbo.json](turbo.json) — Build configuration

---

## Red Flags (Code Review Checklist)

❌ App directly imports PrismaClient  
❌ DB query in a route handler (should be in service)  
❌ Hardcoded Redis/DB connection strings (use .env)  
❌ Unhandled promise rejections in startup  
❌ No atomic transaction in financial operations  
❌ Silent error handling (should fail fast)  
❌ Cross-package imports from apps/ (should go through packages/)  

---

## Production Readiness

**Before trading goes live:**
1. Add row-level security to user data in Postgres
2. Implement audit triggers on orders/trades
3. Set up PgBouncer for external connection pooling
4. Add replication lag checks to /health endpoint
5. Implement graceful shutdown with timeout
6. Test transaction isolation at high concurrency
7. Verify all prices are timestamped on server (no client time)
