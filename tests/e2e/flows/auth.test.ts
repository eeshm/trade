import { afterAll, beforeAll, describe, expect, test } from "vitest";
import { getApiClient, shutdownApiClient } from "../setup/testServer.ts";
import { createTestWallet, signMessage, type TestWallet } from "../helpers/wallet.ts";
import type { SuperTest, Test } from "supertest";

/**
 * Auth Flow E2E Tests
 * 
 * Tests the complete authentication lifecycle:
 * 1. Nonce generation
 * 2. Signature verification + login
 * 3. Session token usage
 * 4. Logout + token revocation
 */

describe("Auth Flow (E2E)", () => {
  let api: SuperTest<Test>;
  let wallet: TestWallet;

  beforeAll(async () => {
    api = await getApiClient();
    wallet = createTestWallet();
  });

  afterAll(async () => {
    await shutdownApiClient();
  });

  describe("POST /auth/nonce", () => {
    test("returns nonce for valid wallet address", async () => {
      const res = await api
        .post("/auth/nonce")
        .query({ walletAddress: wallet.publicKey })
        .send({ walletAddress: wallet.publicKey });

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty("nonce");
      expect(res.body.nonce).toBeTypeOf("string");
      expect(res.body.nonce.length).toBeGreaterThan(0);
      expect(res.body).toHaveProperty("expiresIn", 600);
    });

    test("rejects missing wallet address", async () => {
      const res = await api.post("/auth/nonce").send({});

      expect(res.status).toBe(400);
    });
  });

  describe("POST /auth/login", () => {
    test("authenticates with valid signature and returns token", async () => {
      // Step 1: Get nonce
      const nonceRes = await api
        .post("/auth/nonce")
        .query({ walletAddress: wallet.publicKey })
        .send({ walletAddress: wallet.publicKey });

      expect(nonceRes.status).toBe(200);
      const { nonce } = nonceRes.body;

      // Step 2: Sign the nonce message
      const message = `Sign this nonce: ${nonce}`;
      const signature = signMessage(wallet, message);

      // Step 3: Login with signature
      const loginRes = await api.post("/auth/login").send({
        walletAddress: wallet.publicKey,
        signature,
        nonce,
      });

      expect(loginRes.status).toBe(200);
      expect(loginRes.body).toHaveProperty("token");
      expect(loginRes.body.token).toBeTypeOf("string");
      expect(loginRes.body.token.length).toBeGreaterThan(0);
      expect(loginRes.body).toHaveProperty("userId");
      expect(loginRes.body).toHaveProperty("walletAddress", wallet.publicKey);
    });

    test("rejects invalid signature", async () => {
      // Get fresh nonce
      const nonceRes = await api
        .post("/auth/nonce")
        .query({ walletAddress: wallet.publicKey })
        .send({ walletAddress: wallet.publicKey });

      const { nonce } = nonceRes.body;

      // Create a different wallet and sign with it (wrong signer)
      const wrongWallet = createTestWallet();
      const message = `Sign this nonce: ${nonce}`;
      const badSignature = signMessage(wrongWallet, message);

      const loginRes = await api.post("/auth/login").send({
        walletAddress: wallet.publicKey, // Original wallet
        signature: badSignature, // Signed by different wallet
        nonce,
      });

      expect(loginRes.status).toBe(401);
      expect(loginRes.body).toHaveProperty("error");
    });

    test("rejects expired or reused nonce", async () => {
      // Get nonce
      const nonceRes = await api
        .post("/auth/nonce")
        .query({ walletAddress: wallet.publicKey })
        .send({ walletAddress: wallet.publicKey });

      const { nonce } = nonceRes.body;
      const message = `Sign this nonce: ${nonce}`;
      const signature = signMessage(wallet, message);

      // First login - consumes nonce
      const firstLogin = await api.post("/auth/login").send({
        walletAddress: wallet.publicKey,
        signature,
        nonce,
      });
      expect(firstLogin.status).toBe(200);

      // Second login with same nonce - should fail
      const secondLogin = await api.post("/auth/login").send({
        walletAddress: wallet.publicKey,
        signature,
        nonce,
      });

      expect(secondLogin.status).toBe(401);
      expect(secondLogin.body.error).toContain("nonce");
    });
  });

  describe("Protected endpoints", () => {
    let authToken: string;

    beforeAll(async () => {
      // Authenticate to get token
      const nonceRes = await api
        .post("/auth/nonce")
        .query({ walletAddress: wallet.publicKey })
        .send({ walletAddress: wallet.publicKey });

      const { nonce } = nonceRes.body;
      const message = `Sign this nonce: ${nonce}`;
      const signature = signMessage(wallet, message);

      const loginRes = await api.post("/auth/login").send({
        walletAddress: wallet.publicKey,
        signature,
        nonce,
      });

      authToken = loginRes.body.token;
    });

    test("allows access with valid token", async () => {
      const res = await api
        .get("/portfolio")
        .set("Authorization", `Bearer ${authToken}`);

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty("success", true);
      expect(res.body).toHaveProperty("portfolio");
    });

    test("rejects request without token", async () => {
      const res = await api.get("/portfolio");

      expect(res.status).toBe(401);
    });

    test("rejects request with invalid token", async () => {
      const res = await api
        .get("/portfolio")
        .set("Authorization", "Bearer invalid_token_here");

      expect(res.status).toBe(401);
    });
  });

  describe("POST /auth/logout", () => {
    test("revokes session token", async () => {
      // Create new session for logout test
      const testWallet = createTestWallet();

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

      const token = loginRes.body.token;

      // Verify token works
      const beforeLogout = await api
        .get("/portfolio")
        .set("Authorization", `Bearer ${token}`);
      expect(beforeLogout.status).toBe(200);

      // Logout
      const logoutRes = await api
        .post("/auth/logout")
        .set("Authorization", `Bearer ${token}`)
        .send({ token });

      expect(logoutRes.status).toBe(200);
      expect(logoutRes.body).toHaveProperty("success", true);

      // Verify token no longer works
      const afterLogout = await api
        .get("/portfolio")
        .set("Authorization", `Bearer ${token}`);
      expect(afterLogout.status).toBe(401);
    });
  });
});
