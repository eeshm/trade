import { Decimal } from "decimal.js";

/**
 * Fetch SOL/USD price from Pyth oracle via REST API
 * 
 * Uses Pyth's public REST API (no auth needed)
 * Returns the latest SOL/USD price with proper decimal adjustment
 * 
 * Example:
 * - API returns price: "23050000000" with expo: -10
 * - Real price: 23050000000 * 10^-10 = $230.50
 * 
 * @returns SOL price as Decimal (e.g., "230.50")
 * @throws Error if fetch fails or price is invalid
 */
export async function fetchSolPriceFromPyth(): Promise<Decimal> {
    
}

/**
 * Validate price is reasonable
 * 
 * TODO: Implement validatePrice()
 * - Check not NaN/Infinity
 * - Check price > 0
 * - Check price < 10,000 (sanity check)
 * 
 * @throws Error if price is invalid
 */
export function validatePrice(price: Decimal): void {
  // TODO: Write implementation
  throw new Error("Not implemented");
}
