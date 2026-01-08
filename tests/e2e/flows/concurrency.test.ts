import { afterAll, beforeAll, describe, expect, test } from "vitest";
import { getApiClient, shutdownApiClient } from "../setup/testServer.ts";
import { createTestWallet, signMessage, type TestWallet } from "../helpers/wallet.ts";
import { setTestPrice } from "../helpers/price.ts";
import type { SuperTest, Test } from "supertest";

/**
 * Concurrency E2E Tests
 * 
 * Tests race conditions and data integrity under concurrent access:
 * 1. Double-spend prevention (two orders at same time)
 * 2. Concurrent orders from same user
 * 3. Concurrent session operations
 * 4. Balance integrity after parallel operations
 */

describe("Concurrency (E2E)", () => {
  let api: SuperTest<Test>;

  // Helper to authenticate
  const authenticate = async (testWallet: TestWallet): Promise<string> => {
    const nonceRes = await api
      .post("/auth/nonce")
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
    await setTestPrice("SOL", "100");
  });

  afterAll(async () => {
    await shutdownApiClient();
  });

  describe("Double-Spend Prevention", () => {
    test("prevents spending more than available balance with concurrent orders", async () => {
      // Create fresh wallet with 1000 USDC
      const wallet = createTestWallet();
      const token = await authenticate(wallet);

      // Try to buy 8 SOL twice concurrently (each costs $800 + fees)
      // Total would be $1600+ but user only has $1000
      // One should succeed, one should fail
      const order1Promise = api
        .post("/orders")
        .set("Authorization", `Bearer ${token}`)
        .send({
          side: "buy",
          baseAsset: "SOL",
          quoteAsset: "USDC",
          requestedSize: "8",
        });

      const order2Promise = api
        .post("/orders")
        .set("Authorization", `Bearer ${token}`)
        .send({
          side: "buy",
          baseAsset: "SOL",
          quoteAsset: "USDC",
          requestedSize: "8",
        });

      const [res1, res2] = await Promise.all([order1Promise, order2Promise]);

      // Count successes and failures
      const statuses = [res1.status, res2.status];
      const successCount = statuses.filter((s) => s === 201).length;
      const failCount = statuses.filter((s) => s === 400).length;

      // Exactly one should succeed, one should fail
      expect(successCount).toBe(1);
      expect(failCount).toBe(1);

      // Verify final balance is consistent
      const portfolioRes = await api
        .get("/portfolio")
        .set("Authorization", `Bearer ${token}`);

      const usdcBalance = portfolioRes.body.portfolio.balances.find(
        (b: any) => b.asset === "USDC"
      );
      const solBalance = portfolioRes.body.portfolio.balances.find(
        (b: any) => b.asset === "SOL"
      );

      // Should have ~$200 left (1000 - 800 - 0.80 fee)
      expect(parseFloat(usdcBalance.available)).toBeCloseTo(199.2, 1);
      // Should have exactly 8 SOL
      expect(solBalance.available).toBe("8");
    });

    test("prevents selling more than owned with concurrent sell orders", async () => {
      // Create wallet and buy some SOL first
      const wallet = createTestWallet();
      const token = await authenticate(wallet);

      // Buy 5 SOL
      await api
        .post("/orders")
        .set("Authorization", `Bearer ${token}`)
        .send({
          side: "buy",
          baseAsset: "SOL",
          quoteAsset: "USDC",
          requestedSize: "5",
        });

      // Try to sell 4 SOL twice concurrently (total 8, but only have 5)
      const sell1Promise = api
        .post("/orders")
        .set("Authorization", `Bearer ${token}`)
        .send({
          side: "sell",
          baseAsset: "SOL",
          quoteAsset: "USDC",
          requestedSize: "4",
        });

      const sell2Promise = api
        .post("/orders")
        .set("Authorization", `Bearer ${token}`)
        .send({
          side: "sell",
          baseAsset: "SOL",
          quoteAsset: "USDC",
          requestedSize: "4",
        });

      const [res1, res2] = await Promise.all([sell1Promise, sell2Promise]);

      const statuses = [res1.status, res2.status];
      const successCount = statuses.filter((s) => s === 201).length;
      const failCount = statuses.filter((s) => s === 400).length;

      // Exactly one should succeed
      expect(successCount).toBe(1);
      expect(failCount).toBe(1);

      // Verify SOL balance
      const portfolioRes = await api
        .get("/portfolio")
        .set("Authorization", `Bearer ${token}`);

      const solBalance = portfolioRes.body.portfolio.balances.find(
        (b: any) => b.asset === "SOL"
      );

      // Should have 1 SOL left (5 - 4)
      expect(solBalance.available).toBe("1");
    });
  });

  describe("Concurrent Order Execution", () => {
    test("handles multiple small orders concurrently", async () => {
      const wallet = createTestWallet();
      const token = await authenticate(wallet);

      // Fire 5 concurrent buy orders for 1 SOL each ($100 each)
      // Total: $500 + fees, should all succeed
      const orderPromises = Array(5)
        .fill(null)
        .map(() =>
          api
            .post("/orders")
            .set("Authorization", `Bearer ${token}`)
            .send({
              side: "buy",
              baseAsset: "SOL",
              quoteAsset: "USDC",
              requestedSize: "1",
            })
        );

      const results = await Promise.all(orderPromises);

      // All should succeed
      const allSucceeded = results.every((r) => r.status === 201);
      expect(allSucceeded).toBe(true);

      // Verify final state
      const portfolioRes = await api
        .get("/portfolio")
        .set("Authorization", `Bearer ${token}`);

      const solBalance = portfolioRes.body.portfolio.balances.find(
        (b: any) => b.asset === "SOL"
      );
      expect(solBalance.available).toBe("5");

      // Check order history has all 5 orders
      const ordersRes = await api
        .get("/orders")
        .set("Authorization", `Bearer ${token}`);

      expect(ordersRes.body.orders.length).toBe(5);
    });

    test("maintains balance integrity across buy and sell mix", async () => {
      const wallet = createTestWallet();
      const token = await authenticate(wallet);

      // First buy 10 SOL to have inventory
      await api
        .post("/orders")
        .set("Authorization", `Bearer ${token}`)
        .send({
          side: "buy",
          baseAsset: "SOL",
          quoteAsset: "USDC",
          requestedSize: "5",
        });

      // Fire concurrent mix of buys and sells
      const mixedOrders = [
        { side: "buy", size: "1" },
        { side: "sell", size: "1" },
        { side: "buy", size: "1" },
        { side: "sell", size: "1" },
      ];

      const orderPromises = mixedOrders.map((order) =>
        api
          .post("/orders")
          .set("Authorization", `Bearer ${token}`)
          .send({
            side: order.side,
            baseAsset: "SOL",
            quoteAsset: "USDC",
            requestedSize: order.size,
          })
      );

      const results = await Promise.all(orderPromises);

      // Count results
      const successes = results.filter((r) => r.status === 201).length;

      // At least some should succeed (exact count depends on execution order)
      expect(successes).toBeGreaterThan(0);

      // Verify balance is still positive and consistent
      const portfolioRes = await api
        .get("/portfolio")
        .set("Authorization", `Bearer ${token}`);

      const usdcBalance = portfolioRes.body.portfolio.balances.find(
        (b: any) => b.asset === "USDC"
      );
      const solBalance = portfolioRes.body.portfolio.balances.find(
        (b: any) => b.asset === "SOL"
      );

      // Balances should never go negative
      expect(parseFloat(usdcBalance.available)).toBeGreaterThanOrEqual(0);
      expect(parseFloat(solBalance.available)).toBeGreaterThanOrEqual(0);
    });
  });

  describe("Session Concurrency", () => {
    test("handles concurrent logins from same wallet", async () => {
      const wallet = createTestWallet();

      // Get multiple nonces
      const nonce1Res = await api
        .post("/auth/nonce")
        .send({ walletAddress: wallet.publicKey });
      const nonce2Res = await api
        .post("/auth/nonce")
        .send({ walletAddress: wallet.publicKey });

      const nonce1 = nonce1Res.body.nonce;
      const nonce2 = nonce2Res.body.nonce;

      const message1 = `Sign this nonce: ${nonce1}`;
      const message2 = `Sign this nonce: ${nonce2}`;

      const sig1 = signMessage(wallet, message1);
      const sig2 = signMessage(wallet, message2);

      // Login concurrently
      const [login1, login2] = await Promise.all([
        api.post("/auth/login").send({
          walletAddress: wallet.publicKey,
          signature: sig1,
          nonce: nonce1,
        }),
        api.post("/auth/login").send({
          walletAddress: wallet.publicKey,
          signature: sig2,
          nonce: nonce2,
        }),
      ]);

      // Both should succeed (each gets own session)
      expect(login1.status).toBe(200);
      expect(login2.status).toBe(200);

      // Both tokens should be valid
      const [portfolio1, portfolio2] = await Promise.all([
        api
          .get("/portfolio")
          .set("Authorization", `Bearer ${login1.body.token}`),
        api
          .get("/portfolio")
          .set("Authorization", `Bearer ${login2.body.token}`),
      ]);

      expect(portfolio1.status).toBe(200);
      expect(portfolio2.status).toBe(200);
    });

    test("concurrent requests with same token work correctly", async () => {
      const wallet = createTestWallet();
      const token = await authenticate(wallet);

      // Fire 10 concurrent portfolio reads
      const readPromises = Array(10)
        .fill(null)
        .map(() =>
          api.get("/portfolio").set("Authorization", `Bearer ${token}`)
        );

      const results = await Promise.all(readPromises);

      // All should succeed
      const allSucceeded = results.every((r) => r.status === 200);
      expect(allSucceeded).toBe(true);

      // All should return consistent data
      const balances = results.map(
        (r) =>
          r.body.portfolio.balances.find((b: any) => b.asset === "USDC")
            ?.available
      );
      const uniqueBalances = [...new Set(balances)];

      // Should all have same balance (no read inconsistency)
      expect(uniqueBalances.length).toBe(1);
    });
  });

  describe("Stress Test", () => {
    test("handles burst of 20 concurrent orders without data corruption", async () => {
      const wallet = createTestWallet();
      const token = await authenticate(wallet);

      // Get initial balance
      const initialRes = await api
        .get("/portfolio")
        .set("Authorization", `Bearer ${token}`);
      const initialUsdc = parseFloat(
        initialRes.body.portfolio.balances.find((b: any) => b.asset === "USDC")
          ?.available || "0"
      );

      // Fire 20 orders for 0.1 SOL each ($10 each, $200 total + fees)
      const burstOrders = Array(20)
        .fill(null)
        .map(() =>
          api
            .post("/orders")
            .set("Authorization", `Bearer ${token}`)
            .send({
              side: "buy",
              baseAsset: "SOL",
              quoteAsset: "USDC",
              requestedSize: "0.1",
            })
        );

      const results = await Promise.all(burstOrders);

      const successes = results.filter((r) => r.status === 201);
      const failures = results.filter((r) => r.status !== 201);

      // All should succeed (total cost ~$200 < $1000 balance)
      expect(successes.length).toBe(20);
      expect(failures.length).toBe(0);

      // Verify final state
      const finalRes = await api
        .get("/portfolio")
        .set("Authorization", `Bearer ${token}`);

      const finalUsdc = parseFloat(
        finalRes.body.portfolio.balances.find((b: any) => b.asset === "USDC")
          ?.available || "0"
      );
      const finalSol = parseFloat(
        finalRes.body.portfolio.balances.find((b: any) => b.asset === "SOL")
          ?.available || "0"
      );

      // SOL should be exactly 2 (20 * 0.1)
      expect(finalSol).toBeCloseTo(2, 5);

      // USDC should be ~$798 (1000 - 200 - 0.2 fees)
      // 20 orders * $10 = $200, fees = 0.1% * 200 = $0.20
      expect(finalUsdc).toBeCloseTo(799.8, 1);

      // Verify order count matches
      const ordersRes = await api
        .get("/orders")
        .set("Authorization", `Bearer ${token}`);

      expect(ordersRes.body.orders.length).toBe(20);
    });
  });
});
