/**
 * Candle Aggregation Worker
 * 
 * Separate worker that subscribes to price updates and aggregates them into OHLC candles.
 * 
 * Architecture:
 * - Subscribes to Redis pub/sub channel for price updates
 * - Aggregates prices into 1-minute OHLC candles
 * - Caches current open candle in Redis
 * - Persists closed candles to PostgreSQL
 * - Publishes candle updates for WebSocket broadcast
 * 
 * This worker does NOT:
 * - Touch trading logic
 * - Execute orders
 * - Replace Redis latest price (that's the price-ingestion worker's job)
 */

import { initRedis, isRedisHealthy, subscriber } from "@repo/redis";
import { initDb, shutdownDb } from "@repo/db";
import { subscribeToPrice } from "./subscriber.js";

async function main() {
  console.log("[CANDLE-WORKER] Starting candle aggregation worker...");

  // Initialize Redis (for price subscription + candle caching)
  try {
    await initRedis();
    const isHealthy = await isRedisHealthy();
    if (!isHealthy) {
      throw new Error("Redis is not healthy");
    }
  } catch (error) {
    throw error;
  }

  // Initialize PostgreSQL (for candle persistence)
  try {
    await initDb();
  } catch (error) {
    throw error;
  }

  // Start subscribing to price updates
  await subscribeToPrice();

  // Graceful shutdown
  const shutdown = async (signal: string) => {
    console.log(`[CANDLE-WORKER] ${signal} received, shutting down...`);
    try {
      await subscriber.unsubscribe();
      await shutdownDb();
    } catch (e) {
      // Ignore errors during shutdown
    }
    process.exit(0);
  };

  process.on("SIGINT", () => void shutdown("SIGINT"));
  process.on("SIGTERM", () => void shutdown("SIGTERM"));
}

main().catch((error) => {
  console.error("[CANDLE-WORKER] Fatal error:", error);
  process.exit(1);
});
