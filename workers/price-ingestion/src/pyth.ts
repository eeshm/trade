import { Decimal } from "decimal.js";

interface PythApiResponse {
  data: {
    [key: string]: {
      id: string;
      price: {
        price: string;
        confidence: string;
        expo: number;
        publish_time: number;
      };
    };
  };
  publish_time: number;
}

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
  const pythApiUrl = "https://api.pythnetwork.com/v1/shims/live";
  const solUsdId =
    "0xfe650f0367d4a7ef9815a593ea15ad1d9cf22091670a7df1b0b6b2f377792f6a";

  try {
    const response = await fetch(`${pythApiUrl}?ids=${solUsdId}`, {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
      },
    });

    if (!response.ok) {
      throw new Error(
        `Pyth API request failed with status ${response.status} and message: ${response.statusText}`
      );
    }
    const data: PythApiResponse = await response.json();

    // Extract SOL/USD price data
    const solPriceData = data.data[solUsdId];

    if (!solPriceData || !solPriceData.price) {
      throw new Error("SOL/USD price data not found in Pyth API response");
    }

    const rawPrice = solPriceData.price.price;
    const exponent = solPriceData.price.expo;

    // Adjust price using exponent
    const adjustedPrice = new Decimal(rawPrice).mul(
      new Decimal(10).pow(new Decimal(exponent))
    );

    validatePrice(adjustedPrice);
    return adjustedPrice;
  } catch (error) {
    throw new Error(
      `Failed to fetch SOL price from Pyth: ${error instanceof Error ? error.message : String(error)}`
    );
  }
}

/**
 * Validate price is reasonable
 *
 * Checks:
 * - Not NaN or Infinity
 * - Greater than 0
 * - Less than $10,000 (sanity check for devnet)
 *
 * @throws Error if price is invalid
 */

export function validatePrice(price: Decimal): void {
  // Check for NaN/Infinity
  if (!price.isFinite()) {
    throw new Error(
      `Invalid price: ${price.toString()} is not finite (NaN/Infinity)`
    );
  }

  // Check positive
  if (price.lte(0)) {
    throw new Error(`Invalid price: ${price.toString()} must be > 0`);
  }

  // Sanity check: SOL should never be $1000
  if (price.gt(1000)) {
    throw new Error(
      `Suspicious price: ${price.toString()} seems too high for SOL/USD`
    );
  }
}
