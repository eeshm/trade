/**
 * WebSocket Server Entry Point
 *
 * Main startup file: initialize Redis, create server, start publishers.
 */

import { initRedis, isRedisHealthy } from "@repo/redis";
import { createWebSocketServer, startPublishers } from "./server.js";

const WS_PORT = parseInt(process.env.WS_PORT || "3001", 10);

async function main() {
  console.log("[WS] Starting WebSocket Server...");

  // Initializer Redis
  try {
    await initRedis();
    const health = isRedisHealthy();
    if (!health) {
      throw new Error("Redis health check failed");
    }
    console.log("[WS] Redis connected");
  } catch (error) {
    console.error("[WS] Failed to connect to Redis:", error);
    process.exit(1);
  }

  const wss = createWebSocketServer(WS_PORT);
  console.log(`[WS] WebSocket server listening on port ${WS_PORT}`);

  await startPublishers(wss);
  console.log("[WS] Publishers started");

  console.log("[WS] Ready for connections");

  process.on("SIGINT",()=>{
    console.log("[WS] Shutting down...");
    wss.close(()=>{
      process.exit(0);
    })
  })

  process.on("SIGTERM",()=>{
    console.log("[WS] Shutdown signal received");
    process.exit(0);
  })
}

// Start worker
main().catch((error) => {
  console.error("[WS] Fatal error:", error);
  process.exit(1);
});
