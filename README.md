# Solana Paper Trading Platform

A production-grade paper trading platform for Solana that lets users practice trading with virtual funds before risking real money. Built with clean architecture, row-level locking, and comprehensive E2E test coverage.

---

##  What This Is

This platform simulates real Solana trading with **zero wallet signing** — users authenticate with their wallet but all trades happen with virtual funds stored in PostgreSQL. Real-time prices from Pyth Network, OHLC candlestick charts, WebSocket updates for portfolio changes, and a full order execution engine with proper concurrency controls.

This demonstrates production patterns: event-driven architecture, worker separation, idempotent operations, and defensive database transactions.

---

## Architecture

```
                    ┌─────────────┐
                    │ Pyth Network│
                    └──────┬──────┘
                           │
                    ┌──────▼───────┐
                    │Price Worker  │
                    │(Ingestion)   │
                    └──────┬───────┘
                           │
                    ┌──────▼───────┐
                    │    Redis     │◄────┐
                    │(Price Cache) │     │
                    └──┬────────┬──┘     │
                       │        │        │
           ┌───────────▼─┐   ┌─▼────────▼─────┐
           │Candle Worker│   │   API + WS     │
           │(Aggregation)│   │   (Express)    │
           └──────┬──────┘   └────────┬───────┘
                  │                   │
           ┌──────▼──────┐      ┌─────▼─────┐
           │  PostgreSQL │      │  Frontend │
           │  (Candles)  |----->│  (Next.js)│
           └─────────────┘      └───────────┘
```

### Why Separate Workers?

| Worker | Responsibility | Why Separate |
|--------|---------------|--------------|
| **Price Ingestion** | Fetch from Pyth, publish to Redis | Isolated failure domain, independent scaling |
| **Candle Aggregation** | Subscribe to prices, build OHLC candles | CPU-bound processing, separate from API latency |
| **API Server** | HTTP requests, auth, order execution | Stateless, horizontally scalable |
| **WebSocket Server** | Real-time price/portfolio updates | Stateful connections, needs separate process |

---

## Market Data Architecture

### Price Flow
```
Pyth → Price Worker → Redis (latest price)
                         ↓
                    Candle Worker → PostgreSQL (OHLC history)
                         ↓
                    Chart API (/market/candles)
```

### Storage Strategy

| Data Type | Storage | Reason |
|-----------|---------|--------|
| **Latest Price** | Redis | Sub-millisecond reads, pub/sub for real-time |
| **OHLC Candles** | PostgreSQL | Historical queries, time-series aggregation |
| **Trades** | PostgreSQL | Immutable audit log, source of truth |
| **Sessions** | Redis | TTL support, fast lookups |

**Why not all in Postgres?** Redis gives us sub-1ms price reads and native pub/sub. Postgres handles complex queries and transactional guarantees.

---

## Trading Flow (Market Order Lifecycle)

```typescript
1. POST /orders { side: "buy", size: "1.5" }
   ↓
2. Auth Middleware (validate JWT session)
   ↓
3. Rate Limit Check (Redis-based, 100 req/min)
   ↓
4. Zod Schema Validation
   ↓
5. placeOrder() in @repo/trading
   │
   ├─ BEGIN TRANSACTION
   │  ├─ SELECT balances FOR UPDATE (row lock)
   │  ├─ Check: user has sufficient USDC/SOL
   │  ├─ Get current price from Redis
   │  ├─ Calculate: fee (0.1%), total cost
   │  ├─ INSERT order (immutable record)
   │  ├─ INSERT trade (execution record)
   │  ├─ UPDATE balances (atomic debit/credit)
   │  ├─ UPSERT position (weighted avg price)
   │  └─ COMMIT
   │
   ├─ Publish: order_filled event (Redis pub/sub)
   └─ Publish: portfolio_update event
      ↓
6. WebSocket Server receives events
   └─ Broadcasts to subscribed clients
```

### Concurrency & Correctness

**Row-Level Locking:**
```sql
SELECT * FROM balances WHERE userId = $1 FOR UPDATE;
```
- Prevents race conditions when multiple orders execute simultaneously
- User can't double-spend by submitting concurrent orders
- Database-level guarantee (not app-level)

**Idempotency:**
- Each order has a unique `orderId` (auto-increment)
- Trades reference `orderId` (foreign key)
- Duplicate submissions create separate intent records
- Balance updates are transactional — all-or-nothing

**Invariants Enforced:**
```typescript
// MUST hold after every transaction:
assert(balance.available >= 0);           // No negative balances
assert(balance.available + balance.locked === computed); // Audit matches
assert(orderCount === tradeCount);        // Every order executed
```

---

## Testing

### E2E Test Coverage (144 tests)

| Test Suite | Tests | Coverage |
|------------|-------|----------|
| **Backend E2E** | 103 | Auth, orders, portfolio, candles, concurrency |
| **Frontend Unit** | 41 | Stores (Zustand), order logic, portfolio calculations |

**Critical Scenarios Tested:**
- ✅ Double-spend prevention (concurrent orders blocked)
- ✅ Insufficient balance rejection
- ✅ Sell > owned position rejection
- ✅ Order fills update portfolio atomically
- ✅ P&L calculation accuracy
- ✅ WebSocket auth & subscription lifecycle
- ✅ Candle aggregation (OHLC correctness)

**Run Tests:**
```bash
bun run test        # Backend E2E (requires Docker)
bun run test:web    # Frontend unit tests (no dependencies)
bun run test:all    # All 144 tests
```

---

## What's Intentionally NOT Built

This is **v1: Safe Learning Environment**, not a DEX clone.

**Excluded from v1:**
- ❌ Limit orders (market orders only)
- ❌ Order books (immediate execution)
- ❌ Multi-asset trading (SOL/USDC only)
- ❌ Perpetuals / leverage
- ❌ On-chain transactions (zero wallet signing)
- ❌ Slippage simulation (fixed 0.1% fee)

**Why?** Each adds 10x complexity. v1 proves product-market fit. v2 can add Jupiter routing, multi-asset, and advanced order types **if** users want them.

---

## How to Run Locally

### Prerequisites
- **Bun** (v1.0+)
- **Docker** (for PostgreSQL + Redis)
- **Solana Wallet** (Phantom/Solflare for frontend auth)

### 1. Clone & Install
```bash
git clone https://github.com/eeshm/trade.git
cd trade
bun install
```

### 2. Start Infrastructure
```bash
# PostgreSQL (dev)
docker run -d --name postgres-dev \
  -p 5432:5432 \
  -e POSTGRES_PASSWORD=devpass \
  -e POSTGRES_DB=paper_trading \
  postgres:16

# Redis
docker run -d --name redis-dev \
  -p 6379:6379 \
  redis:7
```

### 3. Configure Environment
```bash
cp .env.example .env
# Edit .env with your settings (see .env.example for details)
```

### 4. Apply Database Migrations
```bash
bun run migrate:dev
```

### 5. Seed Initial Data
```bash
# Seed initial user balances (1000 USDC)
bunx prisma studio  # Or run seed script if available
```

### 6. Start Development Servers
```bash
# Option 1: Start everything
bun run dev

# Option 2: Start individually
bun run dev:api      # API on :3000
bun run dev:ws       # WebSocket on :3001
bun run dev:web      # Frontend on :3002
bun run dev:price    # Price worker
bun run dev:candle   # Candle aggregation worker
```

### 7. Access
- **Frontend:** http://localhost:3002
- **API Health:** http://localhost:3000/health
- **WebSocket:** ws://localhost:3001

---

## Project Structure

```
paper-trading/
├── apps/
│   ├── api/                  # Express REST API (port 3000)
│   ├── ws/                   # WebSocket server (port 3001)
│   └── web/                  # Next.js frontend (port 3002)
├── packages/
│   ├── db/                   # Prisma + PostgreSQL (singleton)
│   ├── redis/                # Redis client + pub/sub
│   ├── auth/                 # Wallet signing, sessions, nonces
│   ├── trading/              # Orders, positions, portfolio
│   ├── pricing/              # Price cache + candle aggregation
│   ├── events/               # Redis pub/sub event publishing
│   └── env/                  # Zod-validated environment config
├── workers/
│   ├── price-ingestion/      # Pyth network price feed
│   └── candle-aggregation/   # OHLC candle builder
├── tests/
│   ├── e2e/                  # Backend E2E tests (103)
│   └── web/                  # Frontend unit tests (41)
└── prisma/
    └── schema.prisma         # Database schema
```

---

## Security Considerations

**Production Checklist:**
- [ ] Rate limiting enabled (Redis-based)
- [ ] JWT secret rotation schedule
- [ ] CORS whitelist configured
- [ ] Helmet.js security headers
- [ ] Input validation (Zod schemas)
- [ ] SQL injection prevention (Prisma parameterized queries)
- [ ] XSS prevention (React auto-escaping)
- [ ] HTTPS enforced (reverse proxy)
- [ ] Environment secrets in secure vault

---

## API Reference

### Auth
- `POST /auth/nonce` - Get signing nonce
- `POST /auth/login` - Login with wallet signature
- `POST /auth/logout` - Invalidate session

### Trading
- `POST /orders` - Place market order (requires auth)
- `GET /orders` - List user's orders (requires auth)

### Portfolio
- `GET /portfolio` - Get balances + positions (requires auth)

### Market Data
- `GET /market/price/:symbol` - Current price (SOL)
- `GET /market/candles?asset=SOL&timeframe=1m&limit=1000` - OHLC history

### Health
- `GET /health` - System health (DB + Redis)

---

## Contributing

1. Fork the repo
2. Create a feature branch: `git checkout -b feature/my-feature`
3. Write tests for new functionality
4. Ensure all tests pass: `bun run test:all`
5. Submit a PR with a clear description

**Code Standards:**
- TypeScript strict mode
- No `any` types
- All public functions documented
- E2E tests for critical paths

---

## License

MIT License - see [LICENSE](LICENSE) for details

---

## Learning Resources

**Solana Concepts:**
- [Pyth Network Documentation](https://docs.pyth.network/)
- [Wallet Adapter Docs](https://github.com/solana-labs/wallet-adapter)

---

## Support

- **Issues:** [GitHub Issues](https://github.com/eeshm/trade/issues)
- **Discussions:** [GitHub Discussions](https://github.com/eeshm/trade/discussions)

---

**Built with:** TypeScript • Express • Next.js • Prisma • Redis • WebSockets • Pyth Network
