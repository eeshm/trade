import { initRedis, isRedisHealthy } from "@repo/redis";
import { fetchSolPriceFromPyth, validatePrice } from "./pyth.js";
import { updateSolPrice } from "./update.js";


const PRICE_UPDATE_INTERVAL_MS = 10 * 1000; // 10 seconds

/**
 * Main worker entry point
 *
 * Lifecycle:
 * 1. Initialize Redis connection
 * 2. Start infinite loop fetching prices every 10 seconds
 * 3. Handle graceful shutdown on SIGINT/SIGTERM
 * 4. Log status periodically
 *
 * The loop continues even on errors (resilient)
 */

async function main() {
  console.log("[WORKER] Initializing price ingestion worker...");

  try {
    await initRedis();
    const isHealthy = await isRedisHealthy();
    if (!isHealthy) {
      throw new Error("Redis is not healthy");
    }

    console.log("[WORKER] Redis initialized and healthy.");
  } catch (error) {
    console.error("[WORKER] Failed to initialize Redis:", error);
    throw error;
  }

  let iteration = 0;
  let lastPrice: string | null = null;

  const loop = async () => {
    iteration++;
    const timestamp = new Date().toISOString();

    try {
      // fetch latest price from Pyth
      const price = await fetchSolPriceFromPyth();
      validatePrice(price);

      // update redis
      await updateSolPrice(price);

      // Track for logging
      const priceStr = price.toString();
      if (priceStr !== lastPrice) {
        console.log(
          `[${timestamp}] [WORKER] [Iteration ${iteration}] Updated SOL price: $${priceStr}`
        );
        lastPrice = priceStr;
      }
      if (iteration % 6 === 0) {
        // every 6 iterations (1 min
        console.log(
          `[${timestamp}] [WORKER] [Iteration ${iteration}] SOL price unchanged at $${priceStr}`
        );
      }
    } catch (error) {
      console.error(
        `[${timestamp}] [WORKER] [Iteration ${iteration}] Error during price ingestion:`,
        error
      );
    }

    setTimeout(loop, PRICE_UPDATE_INTERVAL_MS);
  };
    loop();
    process.on("SIGINT", () => {
      console.log("[WORKER] Caught SIGINT, shutting down gracefully...");
      process.exit(0);
    });
    process.on("SIGTERM", () => {
      console.log("[WORKER] Caught SIGTERM, shutting down gracefully...");
      process.exit(0);
    });
}

main().catch((error) => {
  console.error("[WORKER] Fatal error in price ingestion worker:", error);
  process.exit(1);
});
