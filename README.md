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
