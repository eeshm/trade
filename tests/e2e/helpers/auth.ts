import type { SuperTest, Test } from "supertest";
import { createTestWallet, signMessage, type TestWallet } from "./wallet.ts";

/**
 * Authenticate a test wallet and return the session token
 */
export const authenticateWallet = async (
  api: SuperTest<Test>,
  wallet: TestWallet
): Promise<string> => {
  const nonceRes = await api
    .post("/auth/nonce")
    .query({ walletAddress: wallet.publicKey })
    .send({ walletAddress: wallet.publicKey });

  if (nonceRes.status !== 200) {
    throw new Error(`Failed to get nonce: ${JSON.stringify(nonceRes.body)}`);
  }

  const { nonce } = nonceRes.body;
  const message = `Sign this nonce: ${nonce}`;
  const signature = signMessage(wallet, message);

  const loginRes = await api.post("/auth/login").send({
    walletAddress: wallet.publicKey,
    signature,
    nonce,
  });

  if (loginRes.status !== 200) {
    throw new Error(`Failed to login: ${JSON.stringify(loginRes.body)}`);
  }

  return loginRes.body.token;
};

/**
 * Create a new test wallet and authenticate it
 * Returns both wallet and token for use in tests
 */
export const createAuthenticatedUser = async (
  api: SuperTest<Test>
): Promise<{ wallet: TestWallet; token: string }> => {
  const wallet = createTestWallet();
  const token = await authenticateWallet(api, wallet);
  return { wallet, token };
};
