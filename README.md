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