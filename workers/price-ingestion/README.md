# Price Ingestion Worker

This worker continuously fetches SOL/USD prices from Pyth Network and stores them in Redis for the trading platform.

## How It Works

### Flow Diagram
```
┌─────────────────────────────────────────┐
│ Pyth Network Hermes API                 │
│ (https://hermes.pyth.network)           │
└────────────────┬────────────────────────┘
                 │
                 │ fetchSolPriceFromPyth()
                 ▼
┌─────────────────────────────────────────┐
│ Price Calculation                       │
│ (raw_price * 10^exponent)               │
│ e.g., 23050000000 * 10^-8 = $230.50    │
└────────────────┬────────────────────────┘
                 │
                 │ updateSolPrice()
                 ▼
┌─────────────────────────────────────────┐
│ Redis Storage                           │
│ Key: trading:price:SOL                  │
│ Key: trading:price:SOL:ts               │
└─────────────────────────────────────────┘
```

### Data Storage in Redis

**Price Key**: `trading:price:SOL`
- **Value**: Price as string (e.g., `"230.50"`)
- **Type**: String

**Timestamp Key**: `trading:price:SOL:ts`
- **Value**: ISO 8601 timestamp (e.g., `"2026-01-02T14:35:42.123Z"`)
- **Purpose**: Staleness checking (max 30 seconds)

### Update Interval
- **Frequency**: Every 10 seconds
- **Logging**: Only logs on price changes (to reduce noise)
- **Status**: Logs every 60 seconds (6 iterations) if price unchanged

---

## Running the Worker

### Prerequisites
- Node.js/Bun installed
- Redis running on `localhost:6379` (or configure via `.env`)
- Internet access to fetch from Pyth Network

### Environment Setup

Create `.env` in the root project directory:
```env
REDIS_URL=redis://localhost:6379
NODE_ENV=development
```

### Run in Development Mode

```bash
# From root directory
cd workers/price-ingestion
bun run dev
```

Expected output:
```
[WORKER] Initializing price ingestion worker...
[WORKER] Redis initialized and healthy.
[2026-01-02T14:35:42.123Z] [WORKER] [Iteration 1] Updated SOL price: $230.50
[2026-01-02T14:35:52.456Z] [WORKER] [Iteration 2] Updated SOL price: $230.51
[2026-01-02T14:36:42.789Z] [WORKER] [Iteration 6] SOL price unchanged at $230.51
```

### Build for Production

```bash
# From workers/price-ingestion directory
bun run build
# Output: dist/index.js, dist/pyth.js, dist/update.js
```

### Run in Production

```bash
# From root directory
node workers/price-ingestion/dist/index.js
```

### Run with Multiple Workers (optional)

```bash
# Terminal 1: Start worker
cd workers/price-ingestion
bun run dev

# Terminal 2: Verify Redis updates
redis-cli

# In redis-cli:
> KEYS trading:price:*
> GET trading:price:SOL
> GET trading:price:SOL:ts
```

---

## How It Fetches from Redis

The worker **writes** to Redis, but other services (API, etc.) **read** from it:

### Reading Price in Your API

```typescript
import { getPrice } from '@repo/pricing';

// In your order controller/service:
const solPrice = await getPrice('SOL');
console.log(`Current SOL price: $${solPrice.toString()}`);

// With metadata (debugging):
import { getPriceWithMetadata } from '@repo/pricing';
const priceData = await getPriceWithMetadata('SOL');
if (priceData) {
  console.log(`Price: $${priceData.price}, Age: ${priceData.ageMs}ms`);
}

// Check if price is available:
import { hasPriceAvailable } from '@repo/pricing';
const available = await hasPriceAvailable('SOL');
```

### Staleness Validation

The `getPrice()` function automatically validates:
- Price exists in Redis
- Timestamp is no older than **30 seconds** (`PRICE_STALE_THRESHOLD_MS`)
- Throws error if stale

---

## Monitoring & Debugging

### View Current Price in Redis CLI

```bash
redis-cli

# Get current price
> GET trading:price:SOL
"230.50"

# Get timestamp
> GET trading:price:SOL:ts
"2026-01-02T14:35:42.123Z"

# View all price keys
> KEYS trading:price:*

# Delete a price (useful for testing)
> DEL trading:price:SOL trading:price:SOL:ts
```

### Check Worker Status

```bash
# View logs (shows every price change + every 60s status)
# Worker auto-restarts on error (except fatal startup errors)

# If worker stops unexpectedly:
# 1. Check Redis connection: redis-cli ping
# 2. Check Pyth API: curl https://hermes.pyth.network/v2/updates/price/latest?ids[]=0xef0d8b6fda2ceba41da15d4095d1da392a0d2f8ed0c6c7bc0f4cfac8c280b56d
# 3. Check network: ping hermes.pyth.network
```

### Enable Debug Logging

```bash
# Set environment variable
DEBUG=* bun run dev
# or
NODE_DEBUG=* bun run dev
```

---

## Architecture Notes

### Why 10-Second Interval?
- **Fast enough** for reasonable market responsiveness
- **Low enough** overhead (6 updates/min)
- **Configurable**: Edit `PRICE_UPDATE_INTERVAL_MS` in `src/index.ts`

### Resilience
- Worker continues on fetch errors (doesn't crash)
- Graceful shutdown on `SIGINT`/`SIGTERM`
- Redis health check on startup (fails fast)

### Atomic Storage
- Uses Redis pipeline (`multi()`/`exec()`)
- Price and timestamp always written together
- No partial updates

### No Database Persistence
- Prices stored in Redis only (fast access)
- No historical data stored
- Consider adding Postgres archival if needed

---

## Extending the Worker

### Add More Tokens

1. Update `constants.ts` with new price feed IDs:
```typescript
const SOL_USD_PRICE_FEED_ID = "0x...";
const ETH_USD_PRICE_FEED_ID = "0x...";  // Add this
```

2. Create `fetchEthPriceFromPyth()` function in `pyth.ts`

3. Update `main()` in `index.ts` to fetch multiple prices:
```typescript
const [solPrice, ethPrice] = await Promise.all([
  fetchSolPriceFromPyth(),
  fetchEthPriceFromPyth(),
]);

await Promise.all([
  updateSolPrice(solPrice),
  updateEthPrice(ethPrice),
]);
```

### Push Prices to WebSocket (Future)

Currently, prices are stored in Redis. To push updates to connected clients:

1. Subscribe to Redis pub/sub in `@repo/redis`
2. Publish price updates after storing:
```typescript
await redis.publish('prices:updated', JSON.stringify({ symbol: 'SOL', price: ... }));
```
3. WebSocket server subscribes and broadcasts to clients

---

## Troubleshooting

| Problem | Solution |
|---------|----------|
| **Worker won't start** | Check Redis: `redis-cli ping` should return `PONG` |
| **"Price not available"** | Wait 10 seconds for first update, then try again |
| **"Price is stale"** | Worker crashed or stopped. Check logs and restart |
| **High CPU usage** | Increase `PRICE_UPDATE_INTERVAL_MS` (e.g., 30000 for 30s) |
| **Network timeout** | Check internet connection, Pyth API status |

---

## Files Overview

| File | Purpose |
|------|---------|
| `src/index.ts` | Main worker loop, initialization, shutdown |
| `src/pyth.ts` | Fetch prices from Pyth Hermes API |
| `src/update.ts` | Store prices in Redis |
| `package.json` | Dependencies, scripts |
| `tsconfig.json` | TypeScript config |

---

## Next Steps

- [ ] Add support for more tokens (ETH, BTC)
- [ ] Implement Postgres fallback for price history
- [ ] Add WebSocket real-time price streaming
- [ ] Set up monitoring/alerting for worker health
- [ ] Cache price feed IDs in Redis for faster startup


# Price Worker Quick Start

## TL;DR

```bash
# Start the worker
cd workers/price-ingestion && bun run dev

# Verify it's working
redis-cli
> GET trading:price:SOL
> GET trading:price:SOL:ts

# Use price in your app
import { getPrice } from '@repo/pricing';
const price = await getPrice('SOL');
```

---

## What It Does

1. **Every 10 seconds**: Fetches SOL/USD from Pyth Network
2. **Stores in Redis**:
   - `trading:price:SOL` → price (e.g., "230.50")
   - `trading:price:SOL:ts` → timestamp (e.g., "2026-01-02T14:35:42.123Z")
3. **API reads it**: When placing orders, price is fetched from Redis

---

## Data Flow

```
Pyth API → fetchSolPriceFromPyth() → Redis → getPrice() → Order Execution
```

---

## Commands

| Task | Command |
|------|---------|
| **Start worker** | `cd workers/price-ingestion && bun run dev` |
| **Build** | `bun run build` |
| **Type check** | `bun run check-types` |
| **Check current price** | `redis-cli GET trading:price:SOL` |
| **Check freshness** | `redis-cli GET trading:price:SOL:ts` |
| **Delete stale price** | `redis-cli DEL trading:price:SOL trading:price:SOL:ts` |
| **View all prices** | `redis-cli KEYS trading:price:*` |

---

## How to Use in Your Code

### Get latest price
```typescript
import { getPrice } from '@repo/pricing';

const solPrice = await getPrice('SOL');  // Throws if stale or missing
console.log(`$${solPrice.toString()}`);  // "230.50"
```

### Get price with age info
```typescript
import { getPriceWithMetadata } from '@repo/pricing';

const data = await getPriceWithMetadata('SOL');
if (data) {
  console.log(`Price: $${data.price}`);
  console.log(`Age: ${data.ageMs}ms`);
}
```

### Check if price is available
```typescript
import { hasPriceAvailable } from '@repo/pricing';

if (await hasPriceAvailable('SOL')) {
  // Safe to use getPrice()
}
```

---

## Config

### Change Update Frequency

Edit `workers/price-ingestion/src/index.ts`:
```typescript
const PRICE_UPDATE_INTERVAL_MS = 10 * 1000;  // Change this (in milliseconds)
```

### Change Stale Timeout

Edit `packages/pricing/src/constants.ts`:
```typescript
export const PRICE_STALE_THRESHOLD_MS = 30 * 1000;  // 30 seconds
```

---

## Logging

```
[2026-01-02T14:35:42.123Z] [WORKER] [Iteration 1] Updated SOL price: $230.50
[2026-01-02T14:35:52.456Z] [WORKER] [Iteration 2] Updated SOL price: $230.51
[2026-01-02T14:36:42.789Z] [WORKER] [Iteration 6] SOL price unchanged at $230.51
```

- **Shows price changes** (useful for debugging)
- **Status every 60s** if unchanged (health check)
- **Errors logged** but worker continues

---

## Redis Keys Reference

| Key | Example Value | Used By |
|-----|---|---|
| `trading:price:SOL` | `"230.50"` | Order placement, P&L calculations |
| `trading:price:SOL:ts` | `"2026-01-02T14:35:42.123Z"` | Staleness validation |

---

## Troubleshooting

```bash
# Is Redis running?
redis-cli ping
# Should respond: PONG

# Is worker running?
# Check console for logs, should see updates every 10 seconds

# Is price stale?
redis-cli GET trading:price:SOL:ts
# If missing or >30 seconds old, worker may be down

# Can't connect to Pyth?
curl "https://hermes.pyth.network/v2/updates/price/latest?ids[]=0xef0d8b6fda2ceba41da15d4095d1da392a0d2f8ed0c6c7bc0f4cfac8c280b56d"
# Should return JSON with price data
```

---

## Next: Add More Tokens

1. Find price feed ID from [Pyth docs](https://docs.pyth.network/price-feeds/price-feeds)
2. Add to `src/pyth.ts` (create `fetchEthPriceFromPyth()`)
3. Call both in `src/index.ts`'s `loop()`
4. Use `await getPrice('ETH')` in your app

Done! 🚀
