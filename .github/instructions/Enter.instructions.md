---
applyTo: '**'
---
# Solana Paper Trading Platform — Architecture Overview

## 1. Purpose & Philosophy

This application is a **backend-heavy, exchange-style paper trading platform** focused on Solana (SOL).

The goal is **not** to build a UI demo, but to design a **realistic trading backend** that:
- Simulates order execution, balances, and P&L
- Uses real Solana market data
- Feels Solana-native
- Demonstrates production-grade backend architecture

### Core Identity Principle

**Wallet is NOT balance. Wallet is NOT funds. Wallet is ONLY identity.**

- Wallet address = user identity
- All balances are virtual and stored in Postgres
- No on-chain transactions are executed
- Signing is used only for authentication, not spending

```

Wallet ≠ Funds
Wallet ≠ Balance
Wallet = Identity

```

---

## 2. High-Level System View

The system is composed of **three major layers**:

```

┌───────────────┐
│   Frontend    │
│ (Next.js UI)  │
└───────▲───────┘
│ HTTP / WebSocket
┌───────┴───────────────────────────┐
│          Backend Platform          │
│  (API + WS + Workers + Logic)      │
└───────▲───────────────────────────┘
│
┌───────┴──────────────┐
│ Infrastructure Layer │
│ (Postgres, Redis)    │
└──────────────────────┘

```

---

## 3. Monorepo Architecture (Turborepo)

We use **Turborepo** to enforce clear boundaries and production discipline.

### Why Turborepo?

- Explicit ownership of logic
- Shared code without duplication
- Easy future split into microservices
- Clear mental model for large systems

---

## 4. Repository Structure

```

/
├── apps/
│   ├── api/                # Express REST API
│   ├── ws/                 # WebSocket gateway (real-time)
│   └── web/                # Next.js frontend
│
├── packages/
│   ├── auth/               # Wallet auth & session logic
│   ├── trading/            # Order execution engine (pure logic)
│   ├── pricing/            # Price normalization & models
│   ├── portfolio/          # Position & P&L calculations
│   ├── db/                 # Postgres access & migrations
│   ├── redis/              # Redis client, keys, pub/sub
│   ├── events/             # Event contracts & schemas
│   ├── config/             # Shared tsconfig, eslint, env rules
│   └── utils/              # Shared helpers
│
├── workers/
│   └── price-ingestion/    # Background market data worker
│
└── docs/
└── ARCHITECTURE.md

```

---

## 5. Ownership & Boundary Rules (CRITICAL)

These rules are **non-negotiable** and define production quality.

### Apps (Runtimes)
- `apps/api`, `apps/ws`, `apps/web`
- Handle transport only (HTTP, WS)
- No business logic
- Delegate immediately to packages

### Packages (Logic)
- Contain **all business logic**
- No Express / WebSocket imports
- No direct process/env assumptions
- Designed to be reusable and testable

### Infrastructure Rules

| Component | Ownership |
|---------|----------|
| Postgres | `packages/db` ONLY |
| Redis | `packages/redis` ONLY |
| Auth logic | `packages/auth` |
| Trading logic | `packages/trading` |

> No app may create its own DB or Redis client.

---

## 6. Backend Logical Architecture

```

┌──────────────────────────────────────────┐
│               API Layer                  │
│        (apps/api - Express)              │
│                                          │
│  Routes → Controllers → Services         │
│                                          │
└───────────────▲──────────────────────────┘
│
┌───────────────┴──────────────────────────┐
│            Domain Packages                │
│                                          │
│  auth        → wallet auth, sessions     │
│  trading     → order execution           │
│  portfolio   → balances, P&L             │
│  pricing     → normalized prices         │
│                                          │
└───────────────▲──────────────────────────┘
│
┌───────────────┴──────────────────────────┐
│        Infrastructure Packages            │
│                                          │
│  db          → Postgres                  │
│  redis       → cache, pub/sub            │
│                                          │
└──────────────────────────────────────────┘

```

---

## 7. Authentication Architecture

### Flow

1. Frontend requests nonce
2. User signs nonce with wallet
3. Backend verifies signature
4. Wallet address → user identity
5. Session token issued

### Key Concepts

- Wallet address is immutable identity
- Users are created lazily
- Sessions are stored server-side
- No passwords, no emails

### Tables

- `users` → wallet identity
- `sessions` → authenticated sessions

---

## 8. Market Data System

### Purpose
Provide realistic SOL prices without exposing users directly to external APIs.

### Flow

```

Pyth / Jupiter
↓
Price Ingestion Worker
↓
Redis (latest price)
↓
API + WebSocket

```

### Design Decisions

- Only workers talk to external price sources
- API reads from Redis only
- Redis is the source of "current price"
- Postgres may store historical snapshots later

---

## 9. Trading Engine (Paper Execution)

### Scope (Initial)

- Market orders only
- SOL only
- Fees
- Slippage simulation

### Execution Flow

1. Validate session
2. Read price from Redis
3. Read balances from Postgres
4. Apply slippage & fees
5. Update balances (DB transaction)
6. Insert trade + order records
7. Emit events

### Important Rule

> **Balance updates, trades, and orders must be atomic.**

All state changes occur in a single DB transaction.

---

## 10. Real-Time Architecture (WebSockets)

### Events

- `price_update`
- `order_fill`
- `portfolio_update`

### Flow

```

Redis Pub/Sub
↓
WebSocket Gateway
↓
Connected Clients

```

Redis acts as the **fan-out backbone**.

---

## 11. Data Storage Model

### Postgres (Source of Truth)

- Users
- Sessions
- Balances
- Orders
- Trades
- Positions
- Leaderboards

### Redis (Ephemeral / Fast)

- Latest SOL price
- Pub/Sub events
- Rate limiting
- Temporary locks

> Redis is never the source of truth for money or trades.

---

## 12. Failure & Safety Principles

- Fail fast on startup if DB or Redis is unavailable
- Reject trades if price is stale or missing
- Server timestamps only (no client time)
- Explicit error states > silent degradation

This mirrors real exchange behavior.

---

## 13. Scaling Strategy (Conceptual)

- Horizontal scaling for API & WS
- Redis Pub/Sub for cross-instance messaging
- Postgres with read replicas later
- Workers scale independently

---

## 14. What This Project Demonstrates

- Exchange-style system design
- Event-driven architecture
- Clear domain boundaries
- Solana ecosystem knowledge
- Production backend discipline

This is not a demo app.
This is a **simulated trading system**.