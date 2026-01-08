## New test files layout and test covered 
1. Concurrency Tests (concurrency.test.ts)
- Double-Spend Prevention (2 tests)
- Prevents spending more than available with concurrent buy orders
- Prevents selling more than owned with concurrent sell orders
- Concurrent Order Execution (2 tests)
- Handles multiple small orders concurrently
- Maintains balance integrity across buy/sell mix
- Session Concurrency (2 tests)
- Handles concurrent logins from same wallet
- Concurrent requests with same token work correctly
- Stress Test (1 test)
- Burst of 20 concurrent orders without data corruption


2. Failure Handling Tests (failure.test.ts)
- Price Unavailable (3 tests)
- Rejects order when price not in cache
- Returns 503 for stale price data
- Market price endpoint returns error for missing price
- Input Validation Failures (5 tests)
- Negative/non-numeric/missing/huge order sizes
- Unsupported assets
- Authentication Failures (6 tests)
- Malformed JWT, expired token, empty header, tampered token
- Nonce Handling Failures (3 tests)
- Non-existent nonce, wrong wallet's nonce, empty signature
- Balance Edge Cases (4 tests)
- Exact balance spending, over-by-fee, sell all, sell never-owned
- API Error Response Format (2 tests)
- Consistent error format, no stack trace leaks
- WebSocket Failure Cases (1 test)
- Market status degraded when prices unavailable