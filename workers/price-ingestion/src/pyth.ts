import { Decimal } from "decimal.js";

/**
 * Pyth Hermes API response structure
 * See: https://hermes.pyth.network/docs
 */
interface PythParsedPriceUpdate {
  id: string;
  price: {
    price: string;
    conf: string;
    expo: number;
    publish_time: number;
  };
  ema_price: {
    price: string;
    conf: string;
    expo: number;
    publish_time: number;
  };
  metadata?: {
    slot: number;
    proof_available_time: number;
    prev_publish_time: number;
  };
}

interface PythHermesResponse {
  binary: {
    encoding: string;
    data: string[];
  };
  parsed: PythParsedPriceUpdate[];
}

// SOL/USD price feed ID from Pyth Network
// Source: https://docs.pyth.network/price-feeds/price-feeds
const SOL_USD_PRICE_FEED_ID =
  "0xef0d8b6fda2ceba41da15d4095d1da392a0d2f8ed0c6c7bc0f4cfac8c280b56d";

/**
 * Fetch SOL/USD price from Pyth oracle via Hermes REST API
 *
 * Uses Pyth's Hermes service (no auth needed)
 * Returns the latest SOL/USD price with proper decimal adjustment
 *
 * Example:
 * - API returns price: "23050000000" with expo: -8
 * - Real price: 23050000000 * 10^-8 = $230.50
 *
 * @returns SOL price as Decimal (e.g., "230.50")
 * @throws Error if fetch fails or price is invalid
 */
export async function fetchSolPriceFromPyth(): Promise<Decimal> {
  const hermesUrl = "https://hermes.pyth.network";
  const endpoint = `/v2/updates/price/latest`;

  try {
    // Build URL with price feed ID as query param
    const url = new URL(endpoint, hermesUrl);
    url.searchParams.append("ids[]", SOL_USD_PRICE_FEED_ID);
    console.log(`Fetching SOL price from Pyth Hermes API: ${url.toString()}`);

    const response = await fetch(url.toString(), {
      method: "GET",
      headers: {
        Accept: "application/json",
      },
    });

    if (!response.ok) {
      throw new Error(
        `Pyth Hermes API request failed with status ${response.status}: ${response.statusText}`
      );
    }

    const data: PythHermesResponse = await response.json();

    // Extract SOL/USD price from parsed response
    if (!data.parsed || data.parsed.length === 0) {
      throw new Error("No price data returned from Pyth Hermes API");
    }

    const solPriceData = data.parsed.find(
      (p) => p.id === SOL_USD_PRICE_FEED_ID.replace("0x", "")
    );

    if (!solPriceData || !solPriceData.price) {
      throw new Error("SOL/USD price data not found in Pyth Hermes response");
    }

    const rawPrice = solPriceData.price.price;
    const exponent = solPriceData.price.expo;

    // Adjust price using exponent (e.g., 23050000000 * 10^-8 = 230.50)
    const adjustedPrice = new Decimal(rawPrice).mul(
      new Decimal(10).pow(exponent)
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
