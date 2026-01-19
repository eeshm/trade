import { Decimal } from "decimal.js";

/**
 * Helper to set a test price for candle aggregation tests
 */
export async function setTestPriceForCandles(
  symbol: string, 
  price: string | number
): Promise<void> {
  const { setPrice } = await import("@repo/pricing");
  const decimal = new Decimal(price);
  await setPrice(symbol, decimal);
}

/**
 * Helper to process a price tick for candle testing
 */
export async function processTestPriceTick(
  asset: string,
  price: string | number,
  timestamp?: Date
): Promise<{ candleClosed: boolean; closedCandle?: any; currentCandle: any }> {
  const { processPriceTick } = await import("@repo/pricing");
  const priceDecimal = new Decimal(price);
  return processPriceTick(asset, priceDecimal, timestamp, "1m");
}

/**
 * Helper to get current candle from Redis
 */
export async function getTestCurrentCandle(
  asset: string,
  timeframe: string = "1m"
): Promise<any | null> {
  const { getCurrentCandle } = await import("@repo/pricing");
  return getCurrentCandle(asset, timeframe as any);
}

/**
 * Helper to get bucket start time
 */
export function getTestBucketStart(timestamp: number, timeframeMs: number = 60000): number {
  return Math.floor(timestamp / timeframeMs) * timeframeMs;
}
