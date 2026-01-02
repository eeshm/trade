import { Decimal } from "decimal.js";
import { setPrice } from "@repo/pricing";

/**
 * Update SOL price in Redis cache
 *
 * This writes to:
 * - Key: trading:price:SOL (the price)
 * - Key: trading:price:SOL:ts (the server timestamp)
 *
 * Uses setPrice() from @repo/pricing which handles:
 * - Atomic Redis writes
 * - Server-side timestamp (never client time)
 * - JSON serialization
 *
 * @param price Current SOL/USD price as Decimal
 */
export async function updateSolPrice(price: Decimal): Promise<void> {
  try {
    await setPrice("SOL", price);

    console.log(
      `Updated SOL price in Redis: $${price.toString()} at ${new Date().toISOString()}`
    );
  } catch (error) {
    console.error("Error updating SOL price in Redis:", error);
    throw error;
  }
}
