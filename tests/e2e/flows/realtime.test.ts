import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, test } from "vitest";
import { getApiClient, shutdownApiClient } from "../setup/testServer.ts";
import { startWsServer, stopWsServer, getWsTestPort } from "../setup/testWsServer.ts";
import { createTestWallet, signMessage, type TestWallet } from "../helpers/wallet.ts";
import { setTestPrice } from "../helpers/price.ts";
import {
  createWsClient,
  authenticateWs,
  subscribeToChannel,
  waitForMessage,
  closeWs,
  type WsMessage,
} from "../helpers/websocket.ts";
import type { SuperTest, Test } from "supertest";
import WebSocket from "ws";
import { client as redisClient, redisKeys } from "@repo/redis";

/**
 * Real-time / Market Data E2E Tests
 * 
 * Tests:
 * 1. HTTP market data endpoints
 * 2. WebSocket connection + authentication
 * 3. WebSocket subscriptions
 * 4. Real-time price broadcasts
 * 5. Real-time order/portfolio events
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
 * WebSocket Real-time Tests
 */
describe("WebSocket Real-time (E2E)", () => {
  let api: SuperTest<Test>;
  let wallet: TestWallet;
  let authToken: string;
  let ws: WebSocket;

  // Helper to authenticate via HTTP API
  const getAuthToken = async (testWallet: TestWallet): Promise<string> => {
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
    await startWsServer();
    await setTestPrice("SOL", "100");

    wallet = createTestWallet();
    authToken = await getAuthToken(wallet);
  });

  afterAll(async () => {
    await stopWsServer();
    await shutdownApiClient();
  });

  afterEach(async () => {
    if (ws && ws.readyState !== WebSocket.CLOSED) {
      await closeWs(ws);
    }
  });

  describe("Connection", () => {
    test("connects to WebSocket server", async () => {
      ws = await createWsClient(getWsTestPort());
      expect(ws.readyState).toBe(WebSocket.OPEN);
    });

    test("responds to ping with pong", async () => {
      ws = await createWsClient(getWsTestPort());

      const response = await new Promise<WsMessage>((resolve, reject) => {
        const timeout = setTimeout(() => reject(new Error("Timeout")), 3000);

        ws.on("message", (data) => {
          const msg = JSON.parse(data.toString());
          if (msg.type === "pong") {
            clearTimeout(timeout);
            resolve(msg);
          }
        });

        ws.send(JSON.stringify({ type: "ping" }));
      });

      expect(response.type).toBe("pong");
    });
  });

  describe("Authentication", () => {
    test("authenticates with valid session token", async () => {
      ws = await createWsClient(getWsTestPort());

      const response = await authenticateWs(ws, authToken);

      expect(response.type).toBe("auth");
      expect(response.success).toBe(true);
    });

    test("rejects invalid token", async () => {
      ws = await createWsClient(getWsTestPort());

      const response = await authenticateWs(ws, "invalid_token");

      expect(response.type).toBe("auth");
      expect(response.success).toBe(false);
      expect(response.error).toBeDefined();
    });
  });

  describe("Subscriptions", () => {
    test("subscribes to prices channel", async () => {
      ws = await createWsClient(getWsTestPort());
      await authenticateWs(ws, authToken);

      const response = await subscribeToChannel(ws, "prices");

      expect(response.type).toBe("subscribed");
      expect(response.channel).toBe("prices");
    });

    test("subscribes to portfolio channel", async () => {
      ws = await createWsClient(getWsTestPort());
      await authenticateWs(ws, authToken);

      const response = await subscribeToChannel(ws, "portfolio");

      expect(response.type).toBe("subscribed");
      expect(response.channel).toBe("portfolio");
    });

    test("subscribes to orders channel", async () => {
      ws = await createWsClient(getWsTestPort());
      await authenticateWs(ws, authToken);

      const response = await subscribeToChannel(ws, "orders");

      expect(response.type).toBe("subscribed");
      expect(response.channel).toBe("orders");
    });

    test("unsubscribes from channel", async () => {
      ws = await createWsClient(getWsTestPort());
      await authenticateWs(ws, authToken);
      await subscribeToChannel(ws, "prices");

      const response = await new Promise<WsMessage>((resolve, reject) => {
        const timeout = setTimeout(() => reject(new Error("Timeout")), 3000);

        ws.on("message", (data) => {
          const msg = JSON.parse(data.toString());
          if (msg.type === "unsubscribed") {
            clearTimeout(timeout);
            resolve(msg);
          }
        });

        ws.send(JSON.stringify({ type: "unsubscribe", channel: "prices" }));
      });

      expect(response.type).toBe("unsubscribed");
      expect(response.channel).toBe("prices");
    });
  });

  describe("Real-time Price Updates", () => {
    test("receives price updates after subscribing", async () => {
      ws = await createWsClient(getWsTestPort());
      await authenticateWs(ws, authToken);
      await subscribeToChannel(ws, "prices");

      // Set up listener for price message before publishing
      const pricePromise = waitForMessage(ws, "price", 5000);

      // Publish price update via Redis (simulating price worker)
      const priceEvent = {
        symbol: "SOL",
        price: "155.00",
        timestamp: new Date().toISOString(),
      };
      await redisClient.publish(
        redisKeys.CHANNELS.priceUpdate(),
        JSON.stringify(priceEvent)
      );

      const priceMsg = await pricePromise;

      expect(priceMsg.type).toBe("price");
      expect(priceMsg.symbol).toBe("SOL");
      expect(priceMsg.price).toBe("155.00");
    });
  });

  describe("Real-time Order Events", () => {
    test("receives order_filled event after placing order via API", async () => {
      // Create fresh wallet for this test
      const orderWallet = createTestWallet();
      const orderToken = await getAuthToken(orderWallet);

      ws = await createWsClient(getWsTestPort());
      await authenticateWs(ws, orderToken);
      await subscribeToChannel(ws, "orders");

      // Set up listener before placing order
      const orderPromise = waitForMessage(ws, "order_filled", 10000);

      // Place order via HTTP API
      await setTestPrice("SOL", "100");
      const orderRes = await api
        .post("/orders")
        .set("Authorization", `Bearer ${orderToken}`)
        .send({
          side: "buy",
          baseAsset: "SOL",
          quoteAsset: "USDC",
          requestedSize: "1",
        });

      expect(orderRes.status).toBe(201);

      // Wait for WebSocket event
      const orderMsg = await orderPromise;

      expect(orderMsg.type).toBe("order_filled");
      expect(orderMsg.orderId).toBe(orderRes.body.orderId);
      expect(orderMsg.executedPrice).toBe("100");
      expect(orderMsg.executedSize).toBe("1");
    });

    test("receives portfolio update after order", async () => {
      // Create fresh wallet
      const portfolioWallet = createTestWallet();
      const portfolioToken = await getAuthToken(portfolioWallet);

      ws = await createWsClient(getWsTestPort());
      await authenticateWs(ws, portfolioToken);
      await subscribeToChannel(ws, "portfolio");

      // Set up listener
      const portfolioPromise = waitForMessage(ws, "portfolio", 10000);

      // Place order
      await setTestPrice("SOL", "100");
      await api
        .post("/orders")
        .set("Authorization", `Bearer ${portfolioToken}`)
        .send({
          side: "buy",
          baseAsset: "SOL",
          quoteAsset: "USDC",
          requestedSize: "2",
        });

      // Wait for portfolio update
      const portfolioMsg = await portfolioPromise;

      expect(portfolioMsg.type).toBe("portfolio");
      expect(portfolioMsg.balances).toBeDefined();
      expect(portfolioMsg.positions).toBeDefined();
    });
  });
});
