# Solana Paper Trading Platform

A production-grade paper trading simulator for Solana that enables users to practice trading with virtual funds in a risk-free environment. Built to demonstrate correct implementation of wallet authentication, real-time price feeds (Pyth Network), order execution with ACID guarantees, and WebSocket-based portfolio updates.

This project serves as educational infrastructure for the Solana ecosystem, showing developers how to build financially correct trading systems without blockchain complexity. Users authenticate with their Solana wallet but execute all trades against a PostgreSQL ledger—zero private key exposure, zero gas fees, zero financial risk.

> [!IMPORTANT]
> **PAPER TRADING ONLY**  
> This platform uses virtual funds only. No real cryptocurrency is traded, transferred, or connected to any blockchain network. Wallet connection is used solely for identity verification.

---

## Why This Matters

**For new traders:**
- Learn Solana trading mechanics without financial risk
- Practice with real-time Pyth prices in a safe environment
- Understand order execution, fees, and portfolio management

**For developers:**
- Reference implementation for Solana wallet authentication
- Shows production-grade Pyth Network integration
- Demonstrates concurrent trading logic with ACID guarantees
- Reusable packages: auth, pricing, trading engine

**For the ecosystem:**
- Reduces barrier to entry for Solana DeFi
- Open-source infrastructure for educational tools
- Proves patterns applicable to real DEX development

---

## Architecture

```
                    ┌─────────────┐
                    │ Pyth Network│
                    └──────┬──────┘
                           │
                    ┌──────▼───────┐
                    │Price Worker  │
                    └──────┬───────┘
                           │
                    ┌──────▼───────┐
                    │    Redis     │◄────┐
                    │(Price Cache) │     │
                    └──┬────────┬──┘     │
                       │        │        │
           ┌───────────▼─┐   ┌─▼────────▼─────┐
           │Candle Worker│   │   API + WS     │
           └──────┬──────┘   └────────┬───────┘
                  │                   │
           ┌──────▼──────┐      ┌─────▼─────┐
           │  PostgreSQL │      │  Frontend │
           │  (OHLC)     |----->│  (Next.js)│
           └─────────────┘      └───────────┘
```

**Why separate processes?**
- **Price Worker**: Isolated Pyth ingestion, publishes to Redis pub/sub
- **Candle Worker**: Aggregates ticks into OHLC candles (CPU-bound, separate from API)
- **API**: Stateless REST endpoints for orders/portfolio
- **WebSocket**: Stateful real-time updates for prices and portfolio changes

---

## Market Data: Pyth + Redis + Postgres

**Price flow:**
```
Pyth → Price Worker → Redis (execution price)
                                      ↓
                                Candle Worker → PostgreSQL (OHLC history)
```

| Data | Storage | Why |
|------|---------|-----|
| Latest price | Redis | Sub-millisecond reads for order execution |
| OHLC candles | PostgreSQL | Historical queries, TradingView charts |
| Trades | PostgreSQL | Immutable audit log |
| Sessions | Redis | TTL support, fast auth lookups |

**Design trade-off:** Redis for speed (execution), Postgres for durability (audit + charts).

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

**Row-level locking prevents double-spending:**
```sql
SELECT * FROM balances WHERE userId = $1 FOR UPDATE;
```
- Concurrent orders from same user are serialized
- Database-level guarantee (not app-level)

**Invariants enforced:**
- No negative balances
- `available + locked = total` (always)
- Every order creates exactly one trade

**144 E2E tests** covering:
- ✅ Double-spend prevention
- ✅ Insufficient balance rejection
- ✅ Concurrent order execution
- ✅ WebSocket auth & subscription lifecycle
- ✅ Candle aggregation correctness

---

## Testing

| Test Suite | Tests | Coverage |
|------------|-------|----------|
| **Backend E2E** | 103 | Auth, orders, portfolio, candles, concurrency |
| **Frontend Unit** | 41 | Stores (Zustand), order logic, portfolio calculations |

**Run tests:**
```bash
bun run test        # Backend E2E (requires Docker)
bun run test:web    # Frontend unit tests
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

**Why?** Each adds 10x complexity. v1 proves the core mechanics. v2+ can evolve based on community feedback.

---

## Roadmap

### v2 (Planned)
- **Jupiter integration**: Multi-asset routing, real slippage simulation
- **Advanced orders**: Limit orders, stop-loss, trailing stops
- **Trade analysis**: Replay historical trades, performance metrics
- **Dynamic fees**: Market-based fee tiers, maker/taker distinction

### v3 (Future)
- **Perpetuals simulation**: Leverage, funding rates, liquidations
- **Copy trading**: Follow and test trading strategies
- **Bot framework**: Backtest and paper-trade algorithmic strategies
- **Portfolio analytics**: Sharpe ratio, max drawdown, win rate

**Non-goals:** This will remain paper trading only. No real funds, no on-chain settlement.

---

## Quick Start

**Prerequisites:** Bun, Docker, Solana wallet extension

```bash
# Clone and install
git clone https://github.com/eeshm/trade.git && cd trade && bun install

# Start infrastructure
docker-compose up -d

# Configure environment
cp .env.example .env  # Edit with your settings

# Run migrations
bun run migrate:dev

# Start all services
bun run dev

# Open http://localhost:3002
```

**For detailed setup:** See setup instructions below  
**For production:** See [DEPLOYMENT.md](./DEPLOYMENT.md)

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

See [CONTRIBUTING.md](./CONTRIBUTING.md) for development workflow.

**Code standards:**
- TypeScript strict mode
- E2E tests for critical paths
- No `any` types

---

## License

MIT License - see [LICENSE](./LICENSE)

---

**Built with:** TypeScript • Express • Next.js • Prisma • Redis • WebSockets • Pyth Network
