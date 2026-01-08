import { afterAll, beforeAll, describe, expect, test } from "vitest";
import { getApiClient, shutdownApiClient } from "../setup/testServer.ts";
import { createTestWallet, signMessage, type TestWallet } from "../helpers/wallet.ts";
import { setTestPrice } from "../helpers/price.ts";
import type { SuperTest, Test } from "supertest";
import { Decimal } from "decimal.js";

/**
 * Trading Flow E2E Tests
 * 
 * Tests complete trading lifecycle:
 * 1. Portfolio initialization (new users get 1000 USDC)
 * 2. BUY order execution (immediate fill)
 * 3. SELL order execution
 * 4. Balance + position updates
 * 5. Fee calculations
 * 6. Error cases (insufficient balance, no price)
 */

describe("Trading Flow (E2E)", () => {
  let api: SuperTest<Test>;
  let wallet: TestWallet;
  let authToken: string;

  // Helper to authenticate
  const authenticate = async (testWallet: TestWallet): Promise<string> => {
    const nonceRes = await api
      .post("/auth/nonce")
      .query({ walletAddress: testWallet.publicKey })
      .send({ walletAddress: testWallet.publicKey });

    const { nonce } = nonceRes.body;
    const message = `Sign this nonce: ${nonce}`;
    const signature = signMessage(testWallet, message);

    const loginRes = await api.post("/auth/login").send({
      walletAddress: testWallet.publicKey,
      signature,
      nonce,
    });

    return loginRes.body.token;
  };

  beforeAll(async () => {
    api = await getApiClient();
    wallet = createTestWallet();

    // Seed SOL price at $100 for predictable math
    await setTestPrice("SOL", "100");

    // Authenticate
    authToken = await authenticate(wallet);
  });

  afterAll(async () => {
    await shutdownApiClient();
  });

  describe("Initial Portfolio State", () => {
    test("new user has 1000 USDC and 0 SOL", async () => {
      const res = await api
        .get("/portfolio")
        .set("Authorization", `Bearer ${authToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);

      const { balances, positions } = res.body.portfolio;

      // Find USDC balance
      const usdcBalance = balances.find((b: any) => b.asset === "USDC");
      expect(usdcBalance).toBeDefined();
      expect(usdcBalance.available).toBe("1000");
      expect(usdcBalance.locked).toBe("0");

      // Find SOL balance (may be 0 or not exist)
      const solBalance = balances.find((b: any) => b.asset === "SOL");
      if (solBalance) {
        expect(solBalance.available).toBe("0");
      }
    });
  });

  describe("POST /orders - BUY", () => {
    test("executes buy order immediately at cached price", async () => {
      // Buy 1 SOL at $100 = $100 cost + $0.10 fee (0.1%)
      const res = await api
        .post("/orders")
        .set("Authorization", `Bearer ${authToken}`)
        .send({
          side: "buy",
          baseAsset: "SOL",
          quoteAsset: "USDC",
          requestedSize: "1",
        });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.status).toBe("filled");
      expect(res.body.executedPrice).toBe("100");
      expect(res.body.executedSize).toBe("1");

      // Fee = 0.1% of (price * size) = 0.1% of $100 = $0.10
      const fee = new Decimal(res.body.feesApplied);
      expect(fee.toString()).toBe("0.1");
    });

    test("updates portfolio after buy", async () => {
      const res = await api
        .get("/portfolio")
        .set("Authorization", `Bearer ${authToken}`);

      expect(res.status).toBe(200);

      const { balances, positions } = res.body.portfolio;

      // USDC: Started 1000, spent 100 + 0.10 fee = 899.90
      const usdcBalance = balances.find((b: any) => b.asset === "USDC");
      expect(usdcBalance).toBeDefined();
      const usdcAvailable = new Decimal(usdcBalance.available);
      expect(usdcAvailable.toString()).toBe("899.9");

      // SOL: Should have 1
      const solBalance = balances.find((b: any) => b.asset === "SOL");
      expect(solBalance).toBeDefined();
      expect(solBalance.available).toBe("1");

      // Position should exist
      const solPosition = positions.find((p: any) => p.asset === "SOL");
      expect(solPosition).toBeDefined();
      expect(solPosition.size).toBe("1");
      expect(solPosition.avgEntryPrice).toBe("100");
    });

    test("allows multiple buy orders", async () => {
      // Buy another 2 SOL
      const res = await api
        .post("/orders")
        .set("Authorization", `Bearer ${authToken}`)
        .send({
          side: "buy",
          baseAsset: "SOL",
          quoteAsset: "USDC",
          requestedSize: "2",
        });

      expect(res.status).toBe(201);
      expect(res.body.status).toBe("filled");

      // Check position updated
      const portfolioRes = await api
        .get("/portfolio")
        .set("Authorization", `Bearer ${authToken}`);

      const solBalance = portfolioRes.body.portfolio.balances.find(
        (b: any) => b.asset === "SOL"
      );
      expect(solBalance.available).toBe("3"); // 1 + 2 = 3 SOL
    });
  });

  describe("POST /orders - SELL", () => {
    test("executes sell order and returns proceeds", async () => {
      // Sell 1 SOL at $100 = $100 proceeds - $0.10 fee
      const res = await api
        .post("/orders")
        .set("Authorization", `Bearer ${authToken}`)
        .send({
          side: "sell",
          baseAsset: "SOL",
          quoteAsset: "USDC",
          requestedSize: "1",
        });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.status).toBe("filled");
    });

    test("updates portfolio after sell", async () => {
      const res = await api
        .get("/portfolio")
        .set("Authorization", `Bearer ${authToken}`);

      const solBalance = res.body.portfolio.balances.find(
        (b: any) => b.asset === "SOL"
      );
      expect(solBalance.available).toBe("2"); // Had 3, sold 1 = 2
    });

    test("rejects sell when insufficient SOL", async () => {
      // Try to sell 100 SOL when we only have 2
      const res = await api
        .post("/orders")
        .set("Authorization", `Bearer ${authToken}`)
        .send({
          side: "sell",
          baseAsset: "SOL",
          quoteAsset: "USDC",
          requestedSize: "100",
        });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.error).toContain("Insufficient");
    });
  });

  describe("POST /orders - Error Cases", () => {
    test("rejects buy when insufficient USDC", async () => {
      // Try to buy 1000 SOL at $100 = $100,000 (way more than balance)
      const res = await api
        .post("/orders")
        .set("Authorization", `Bearer ${authToken}`)
        .send({
          side: "buy",
          baseAsset: "SOL",
          quoteAsset: "USDC",
          requestedSize: "1000",
        });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.code).toBe("INSUFFICIENT_BALANCE");
    });

    test("rejects invalid order side", async () => {
      const res = await api
        .post("/orders")
        .set("Authorization", `Bearer ${authToken}`)
        .send({
          side: "invalid",
          baseAsset: "SOL",
          quoteAsset: "USDC",
          requestedSize: "1",
        });

      expect(res.status).toBe(400);
    });

    test("rejects zero or negative size", async () => {
      const res = await api
        .post("/orders")
        .set("Authorization", `Bearer ${authToken}`)
        .send({
          side: "buy",
          baseAsset: "SOL",
          quoteAsset: "USDC",
          requestedSize: "0",
        });

      expect(res.status).toBe(400);
    });

    test("rejects order without authentication", async () => {
      const res = await api.post("/orders").send({
        side: "buy",
        baseAsset: "SOL",
        quoteAsset: "USDC",
        requestedSize: "1",
      });

      expect(res.status).toBe(401);
    });
  });

  describe("GET /orders", () => {
    test("returns user order history", async () => {
      const res = await api
        .get("/orders")
        .set("Authorization", `Bearer ${authToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(Array.isArray(res.body.orders)).toBe(true);

      // Should have orders from previous tests
      expect(res.body.orders.length).toBeGreaterThan(0);

      // All should be filled (market orders)
      for (const order of res.body.orders) {
        expect(order.status).toBe("filled");
      }
    });
  });

  describe("Fee Calculations", () => {
    test("correctly calculates 0.1% fee", async () => {
      // Create fresh wallet for clean calculation
      const freshWallet = createTestWallet();
      const freshToken = await authenticate(freshWallet);

      // Buy 5 SOL at $100 = $500 cost, fee = $0.50
      const res = await api
        .post("/orders")
        .set("Authorization", `Bearer ${freshToken}`)
        .send({
          side: "buy",
          baseAsset: "SOL",
          quoteAsset: "USDC",
          requestedSize: "5",
        });

      expect(res.status).toBe(201);
      expect(res.body.feesApplied).toBe("0.5"); // 0.1% of $500

      // Verify balance: 1000 - 500 - 0.5 = 499.5
      const portfolioRes = await api
        .get("/portfolio")
        .set("Authorization", `Bearer ${freshToken}`);

      const usdcBalance = portfolioRes.body.portfolio.balances.find(
        (b: any) => b.asset === "USDC"
      );
      expect(usdcBalance.available).toBe("499.5");
    });
  });
});
