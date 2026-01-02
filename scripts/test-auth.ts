import { Keypair } from "@solana/web3.js";
import nacl from "tweetnacl";
import bs58 from "bs58";
import { Decimal } from "decimal.js";

const API_URL = "http://localhost:3001";

// Helper function for pretty printing
function logSection(title: string) {
  console.log(`\n${"=".repeat(60)}`);
  console.log(`  ${title}`);
  console.log(`${"=".repeat(60)}`);
}

function logSubsection(title: string) {
  console.log(`\n--- ${title} ---`);
}

function logSuccess(message: string, data?: any) {
  console.log(`✅ ${message}`);
  if (data) console.log(JSON.stringify(data, null, 2));
}

function logError(message: string, error?: any) {
  console.log(`❌ ${message}`);
  if (error) console.log(JSON.stringify(error, null, 2));
}

async function testHealthCheck() {
  logSubsection("Health Check");
  try {
    const res = await fetch(`${API_URL}/health`);
    if (!res.ok) {
      logError("Health check failed", await res.json());
      return false;
    }
    const data = await res.json();
    logSuccess("Health check passed", data);
    return true;
  } catch (error) {
    logError("Health check error", error);
    return false;
  }
}

async function testMarketPrices() {
  logSubsection("Get Market Prices");
  try {
    // Get single price
    const singleRes = await fetch(`${API_URL}/market/price/SOL`);
    if (singleRes.ok) {
      const data = await singleRes.json();
      logSuccess("Single price fetched", data);
    } else {
      logError("Failed to get single price", await singleRes.json());
    }

    // Get all prices
    const allRes = await fetch(`${API_URL}/market/prices`);
    if (allRes.ok) {
      const data = await allRes.json();
      logSuccess("All prices fetched", data);
    } else {
      logError("Failed to get all prices", await allRes.json());
    }

    // Get market status
    const statusRes = await fetch(`${API_URL}/market/status`);
    if (statusRes.ok) {
      const data = await statusRes.json();
      logSuccess("Market status fetched", data);
    } else {
      logError("Failed to get market status", await statusRes.json());
    }
  } catch (error) {
    logError("Market prices test error", error);
  }
}

async function testAuthFlow() {
  // 1. Generate test wallet
  const keypair = Keypair.generate();
  const walletAddress = keypair.publicKey.toBase58();
  
  logSubsection("Generate Test Wallet");
  logSuccess("Wallet generated", { walletAddress });

  // 2. Get nonce
  logSubsection("Get Nonce");
  const nonceRes = await fetch(`${API_URL}/auth/nonce`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ walletAddress }),
  });

  if (!nonceRes.ok) {
    logError("Failed to get nonce", await nonceRes.json());
    return null;
  }

  const nonceData = await nonceRes.json();
  logSuccess("Nonce received", nonceData);
  const nonce = nonceData.nonce;

  // 3. Sign message
  logSubsection("Sign Message");
  const message = `Sign this nonce: ${nonce}`;
  const messageBytes = new TextEncoder().encode(message);
  const signature = nacl.sign.detached(messageBytes, keypair.secretKey);
  const signatureBase58 = bs58.encode(signature);
  logSuccess("Message signed", { signature: signatureBase58.substring(0, 20) + "..." });

  // 4. Login
  logSubsection("Login with Signature");
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
    logError("Login failed", await loginRes.json());
    return null;
  }

  const session = await loginRes.json();
  logSuccess("Login successful", {
    userId: session.userId,
    sessionId: session.sessionId,
    token: session.token.substring(0, 20) + "...",
  });

  return { session, keypair, walletAddress };
}

async function testPortfolio(token: string) {
  logSubsection("Get Portfolio");
  try {
    const res = await fetch(`${API_URL}/portfolio`, {
      headers: {
        "Authorization": `Bearer ${token}`,
      },
    });

    if (!res.ok) {
      logError("Portfolio fetch failed", await res.json());
      return null;
    }

    const data = await res.json();
    logSuccess("Portfolio retrieved", data.portfolio);
    return data.portfolio;
  } catch (error) {
    logError("Portfolio test error", error);
    return null;
  }
}

async function testPlaceOrder(token: string, portfolio: any) {
  logSubsection("Place Order (BUY)");
  try {
    // Portfolio structure: { userId, balances: [...], positions: [...], openOrders: [...] }
    if (!portfolio || !portfolio.balances) {
      logError("Invalid portfolio structure", portfolio);
      return;
    }

    // Check if user has USD or USDC balance (support both)
    const quoteBalance = portfolio.balances.find(
      (b: any) => b.asset === "USD" || b.asset === "USDC"
    );
    
    if (!quoteBalance || new Decimal(quoteBalance.available).lte(0)) {
      logError("Insufficient quote balance to place order", { quoteBalance });
      return;
    }

    const quoteAsset = quoteBalance.asset; // Use whatever quote asset is available
    logSuccess(`Found quote balance: ${quoteBalance.available} ${quoteAsset}`);

    const orderPayload = {
      side: "buy",
      baseAsset: "SOL",
      quoteAsset: quoteAsset, // Use the actual quote asset (USD or USDC)
      requestedSize: "0.5", // Buy 0.5 SOL (smaller amount for testing)
    };

    const res = await fetch(`${API_URL}/orders`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${token}`,
      },
      body: JSON.stringify(orderPayload),
    });

    if (!res.ok) {
      logError("Order placement failed", await res.json());
      return;
    }

    const order = await res.json();
    logSuccess("Order placed successfully", order);
    return order;
  } catch (error) {
    logError("Order placement test error", error);
  }
}

async function testGetOrders(token: string) {
  logSubsection("Get User Orders");
  try {
    const res = await fetch(`${API_URL}/orders`, {
      headers: {
        "Authorization": `Bearer ${token}`,
      },
    });

    if (!res.ok) {
      logError("Get orders failed", await res.json());
      return;
    }

    const orders = await res.json();
    logSuccess("Orders retrieved", {
      count: orders.orders?.length || 0,
      orders: orders.orders?.slice(0, 2), // Show first 2
    });
  } catch (error) {
    logError("Get orders test error", error);
  }
}

async function main() {
  logSection("PAPER TRADING API - COMPREHENSIVE TEST SUITE");
  console.log(`API URL: ${API_URL}\n`);

  logSection("1. HEALTH CHECK");
  const healthy = await testHealthCheck();
  if (!healthy) {
    console.error("\n❌ API is not healthy. Stopping tests.");
    process.exit(1);
  }

  logSection("2. MARKET DATA");
  await testMarketPrices();

  logSection("3. AUTHENTICATION");
  const authResult = await testAuthFlow();
  if (!authResult) {
    console.error("\n❌ Authentication failed. Stopping tests.");
    process.exit(1);
  }
  const { session, walletAddress } = authResult;

  logSection("4. PORTFOLIO");
  const portfolio = await testPortfolio(session.token);

  logSection("5. ORDERS");
  if (portfolio) {
    await testPlaceOrder(session.token, portfolio);
    await testGetOrders(session.token);
  }

  logSection("TEST SUITE COMPLETE");
  console.log(`\nWallet: ${walletAddress}`);
  console.log(`Token: ${session.token.substring(0, 30)}...`);
  console.log("\n✅ All tests completed!");
  process.exit(0);
}

main().catch((error) => {
  console.error("\n❌ Test suite error:", error);
  process.exit(1);
});
