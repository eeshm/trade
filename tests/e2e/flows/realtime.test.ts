import { afterAll, beforeAll, describe, expect, test } from "vitest";
import { getApiClient, shutdownApiClient } from "../setup/testServer.ts";
import { createTestWallet, signMessage, type TestWallet } from "../helpers/wallet.ts";
import { setTestPrice } from "../helpers/price.ts";
import type { SuperTest, Test } from "supertest";

/**
 * Real-time / Market Data E2E Tests
 * 
 * Tests market data endpoints:
 * 1. GET /market/price/:symbol - single price
 * 2. GET /market/prices - all prices
 * 3. GET /market/status - market health
 * 
 * Note: Full WebSocket E2E tests require a running WS server.
 * These tests focus on the HTTP market data endpoints.
 */

describe("Market Data (E2E)", () => {
  let api: SuperTest<Test>;

  beforeAll(async () => {
    api = await getApiClient();

    // Seed test prices
    await setTestPrice("SOL", "150.50");
  });

  afterAll(async () => {
    await shutdownApiClient();
  });

  describe("GET /market/price/:symbol", () => {
    test("returns price for SOL", async () => {
      const res = await api.get("/market/price/SOL");

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body).toHaveProperty("symbol", "SOL");
      expect(res.body).toHaveProperty("price", "150.50");
      expect(res.body).toHaveProperty("timestamp");
      expect(res.body).toHaveProperty("ageMs");
    });

    test("is case-insensitive", async () => {
      const res = await api.get("/market/price/sol");

      expect(res.status).toBe(200);
      expect(res.body.symbol).toBe("SOL");
    });

    test("returns 400 for unsupported symbol", async () => {
      const res = await api.get("/market/price/UNKNOWN");

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.code).toBe("UNSUPPORTED_SYMBOL");
    });
  });

  describe("GET /market/prices", () => {
    test("returns all available prices", async () => {
      const res = await api.get("/market/prices");

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body).toHaveProperty("prices");
      expect(typeof res.body.prices).toBe("object");

      // SOL should be available since we seeded it
      expect(res.body.prices.SOL).toBeDefined();
      expect(res.body.prices.SOL.available).toBe(true);
      expect(res.body.prices.SOL.price).toBe("150.50");
    });
  });

  describe("GET /market/status", () => {
    test("returns market status", async () => {
      const res = await api.get("/market/status");

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty("status");
    });
  });
});

/**
 * WebSocket Real-time Tests (Placeholder)
 * 
 * Full implementation requires:
 * 1. Starting WS server alongside API
 * 2. WebSocket client library (ws)
 * 3. Async message handling
 * 
 * Test scenarios to implement:
 * - Connect and authenticate
 * - Subscribe to price channel
 * - Receive price updates when setTestPrice() called
 * - Subscribe to portfolio channel
 * - Receive order fill events when order placed via API
 */

describe.skip("WebSocket Real-time (E2E)", () => {
  test.todo("connects and authenticates via WS");
  test.todo("receives price updates on subscription");
  test.todo("receives order + portfolio events after API order");
});
