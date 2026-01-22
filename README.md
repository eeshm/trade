## Folder Structure 
```
  apps/
  api/
  ws/
  web/
  workers/price-ingestion/

packages/
  config/
  db/
  redis/
  auth/
  pricing/
  trading/
  events/
  utils/

```


“apps/api is responsible for HTTP request handling only.
It does not own business logic or infrastructure details.”

“All database access lives in packages/db.
Apps consume DB functionality through exported functions only.”

“Redis is infrastructure. Infrastructure is centralized.”


"Before touching tables or code, define these rules:
Wallet address is the unique user identity
One wallet = one user
Users are created lazily (on first login)
Authentication = signature verification
Authorization = session validation
These rules will guide every future decision."



Truth before trading logic
(these must always hold:)
- A user can never spend more than their balance
- Every trade is auditable
- Balances must be derivable from history (at least logically)
- Orders are intent, trades are execution
- Postgres is the source of truth
- Redis is never authoritative
If a schema violates these → it’s wrong.



// After Pyth netwrok setup 

- [ ] Add support for more tokens (ETH, BTC)
- [ ] Implement Postgres fallback for price history
- [ ] Add WebSocket real-time price streaming
- [ ] Set up monitoring/alerting for worker health
- [ ] Cache price feed IDs in Redis for faster startup



// implement fees slider and based of that calculate the total amount to be paid
// remove the hardcode fees from 0.1%\




v1 (Live)
- Fixed 0.1% fee simulation
- Spot SOL trading
- Leaderboards & tutorials
- Wallet-based identity

v2

- Jupiter-powered routing
- Dynamic fees & slippage
- Multi-hop swaps
- Trade replay & analysis

v3 (Future)
- Perps simulation
- NFT paper trading
- Copy trading & bot testing
- This is a clean, fundable roadmap.



## Names
SolPlay 
SolQuest 
PreFlight 
Slipstream 
SolLab 
DryRun 
SolArena 







Below is a **strict v1 definition**. If it’s not on this list, it should wait.

---

# ✅ v1 = “Solana Trading Playground (MVP)”

**Goal of v1:**

> Prove that new users want a safe place to practice Solana trading.

Nothing more.

---

## 🧩 Core v1 Features (NON-NEGOTIABLE)

### 1️⃣ Paper Wallet

* Starts with fake SOL (e.g. 100 SOL)
* Simple balances (SOL only)
* Reset option

Why:

> Everything else depends on this.

---

### 2️⃣ Spot Trading (SOL only)

* Buy / sell SOL with fake SOL
* Market-style execution (no limit orders)
* Fixed fee (0.1%)

Why:

> One asset keeps UX and logic simple.

---

### 3️⃣ Real-Time Prices

* Live SOL price feed
* Clear price chart (basic)

Why:

> Without this, it’s not real practice.

---

### 4️⃣ Simple Fee + Slippage Simulation

* Fixed 0.1% fee
* Optional tiny slippage

Why:

> Teach “trades aren’t free” without complexity.

---

### 5️⃣ Weekly Leaderboard

* Rank by PnL %
* Reset weekly
* Top 10 / Top 100

Why:

> Engagement + retention signal.

---

### 6️⃣ Guided Tutorials / Quests (3–5)

Examples:

* “Make your first trade”
* “Buy vs sell”
* “What is slippage?”
* “Why fees matter”

Why:

> This is your onboarding story.

---

### 7️⃣ Wallet Connect (Read-Only)

* Phantom / Solflare
* No signing
* Used as user identity

Why:

> Web3-native onboarding without risk.

---

## 🚫 Explicitly OUT of v1

Do NOT add these yet:

* ❌ Jupiter routing
* ❌ Memecoins
* ❌ Perps
* ❌ NFTs
* ❌ Copy trading
* ❌ Bots
* ❌ Social feeds
* ❌ Dynamic fees

v1 ≠ “almost real trading”
v1 = “safe learning environment”

---

## 📐 Technical Constraints (important)

v1 should:

* Work with **mocked or simple logic**
* Have **clean abstractions** (fees, execution)
* Be **upgrade-friendly** to v2

If a feature makes upgrading harder → cut it.

---

## 🧪 Success Metrics for v1 (what you track)

Even basic metrics :

* Users who complete first trade
* Tutorials completed
* Trades per user
* % returning after 7 days

You don’t need many users — just signal.

---

## 🧾 How v1 is described publicly (copy this)

> “A Solana-native paper trading playground that lets new users practice trading with fake SOL before using real money.”

Simple. Honest. Fundable.

---

## 🏁 v1 Launch Checklist

Before you ship:

* [ ] Can a user trade in <60 seconds?
* [ ] No wallet signing required?
* [ ] No broken edge cases?
* [ ] Tutorials actually guide actions?



// things to look after new candle aggregation worker:
- candle correctness
- front-end price and candle correctness
- websocket reconnecting afrer reload.