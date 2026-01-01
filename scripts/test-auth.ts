import { Keypair } from "@solana/web3.js";
import nacl from "tweetnacl";
import bs58 from "bs58";

const API_URL = "http://localhost:3001";

async function testAuth() {
  // 1. Generate test wallet
  const keypair = Keypair.generate();
  const walletAddress = keypair.publicKey.toBase58();
  console.log("=== Testing Auth Flow ===\n");
  console.log("Wallet Address:", walletAddress);

  // 2. Get nonce
  console.log("\n--- Step 1: Getting nonce ---");
  const nonceRes = await fetch(`${API_URL}/auth/nonce`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ walletAddress }),
  });
  
  if (!nonceRes.ok) {
    console.error("Failed to get nonce:", await nonceRes.text());
    return;
  }
  
  const nonceData = await nonceRes.json();
  console.log("Nonce response:", nonceData);
  const nonce = nonceData.nonce;

  // 3. Sign message
  console.log("\n--- Step 2: Signing message ---");
  const message = `Sign this nonce: ${nonce}`;
  console.log("Message to sign:", message);
  
  const messageBytes = new TextEncoder().encode(message);
  const signature = nacl.sign.detached(messageBytes, keypair.secretKey);
  const signatureBase58 = bs58.encode(signature);
  console.log("Signature:", signatureBase58);

  // 4. Login
  console.log("\n--- Step 3: Logging in ---");
  const loginRes = await fetch(`${API_URL}/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      walletAddress,
      signature: signatureBase58,
      nonce,
    }),
  });
  
  if (!loginRes.ok) {
    console.error("Login failed:", await loginRes.text());
    return;
  }
  
  const session = await loginRes.json();
  console.log("Login response:", session);

  // 5. Test authenticated endpoint (portfolio)
  console.log("\n--- Step 4: Testing /portfolio endpoint ---");
  const portfolioRes = await fetch(`${API_URL}/portfolio`, {
    headers: {
      "Authorization": `Bearer ${session.token}`,
    },
  });
  
  if (!portfolioRes.ok) {
    console.error("Portfolio fetch failed:", await portfolioRes.text());
    return;
  }
  
  const portfolio = await portfolioRes.json();
  console.log("Portfolio:", JSON.stringify(portfolio, null, 2));

  console.log("\n=== Auth Flow Complete ===");
  console.log("Token for further testing:", session.token);
}

testAuth().catch(console.error);
