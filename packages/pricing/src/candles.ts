/**
 * Candle Aggregation Module
 * 
 * Aggregates price ticks into OHLC candles for charting.
 * 
 * Architecture:
 * - Current open candle is cached in Redis (fast updates)
 * - Closed candles are persisted to PostgreSQL (historical data)
 * - Worker calls processPriceTick() on each price update
 * - When minute boundary crossed, candle is finalized and saved
 * 
 * This module does NOT:
 * - Touch trading logic
 * - Execute orders  
 * - Replace Redis latest price
 */

import { Decimal } from 'decimal.js';
import { client as redis, redisKeys } from '@repo/redis';
import { getDb } from '@repo/db';

// Candle data structure
export interface OHLCCandle {
  asset: string;
  timeframe: string;
  bucketStart: number;  // Unix timestamp (ms) of candle start
  open: string;         // Decimal string
  high: string;
  low: string;
  close: string;
  volume: string;
}

// Timeframe in milliseconds
export const TIMEFRAME_MS = {
  '1m': 60 * 1000,
  '5m': 5 * 60 * 1000,
  '15m': 15 * 60 * 1000,
  '1h': 60 * 60 * 1000,
} as const;

export type Timeframe = keyof typeof TIMEFRAME_MS;

/**
 * Calculate bucket start time for a given timestamp
 * 
 * @param timestamp Unix timestamp in ms
 * @param timeframe Candle timeframe
 * @returns Bucket start as Unix timestamp in ms
 */
export function getBucketStart(timestamp: number, timeframe: Timeframe = '1m'): number {
  const intervalMs = TIMEFRAME_MS[timeframe];
  return Math.floor(timestamp / intervalMs) * intervalMs;
}

/**
 * Get current open candle from Redis cache
 * 
 * @param asset Token symbol (e.g., 'SOL')
 * @param timeframe Candle timeframe
 * @returns Current candle or null if none exists
 */
export async function getCurrentCandle(
  asset: string, 
  timeframe: Timeframe = '1m'
): Promise<OHLCCandle | null> {
  const key = redisKeys.CANDLES.currentCandle(asset, timeframe);
  const data = await redis.get(key);
  
  if (!data) return null;
  
  try {
    return JSON.parse(data) as OHLCCandle;
  } catch {
    return null;
  }
}

/**
 * Save current candle to Redis cache
 * 
 * @param candle OHLC candle to cache
 */
async function saveCurrentCandle(candle: OHLCCandle): Promise<void> {
  const key = redisKeys.CANDLES.currentCandle(candle.asset, candle.timeframe);
  await redis.set(key, JSON.stringify(candle));
}

/**
 * Persist a closed candle to PostgreSQL
 * Uses upsert to ensure idempotency
 * 
 * @param candle Closed OHLC candle
 */
export async function persistCandle(candle: OHLCCandle): Promise<void> {
  const db = getDb();
  
  
  await db.candles.upsert({
    where: {
      asset_timeframe_bucketStart: {
        asset: candle.asset,
        timeframe: candle.timeframe,
        bucketStart: new Date(candle.bucketStart),
      },
    },
    create: {
      asset: candle.asset,
      timeframe: candle.timeframe,
      bucketStart: new Date(candle.bucketStart),
      open: new Decimal(candle.open),
      high: new Decimal(candle.high),
      low: new Decimal(candle.low),
      close: new Decimal(candle.close),
      volume: new Decimal(candle.volume),
    },
    update: {
      // Update if somehow we're persisting twice (idempotent)
      high: new Decimal(candle.high),
      low: new Decimal(candle.low),
      close: new Decimal(candle.close),
      volume: new Decimal(candle.volume),
    },
  });
}

/**
 * Process a new price tick and update candle aggregation
 * 
 * This is the main entry point called by the price worker.
 * 
 * Logic:
 * 1. Calculate current bucket from timestamp
 * 2. If bucket differs from cached candle's bucket:
 *    - Persist the old candle to DB
 *    - Start a new candle
 * 3. Update the current candle's OHLC values
 * 4. Cache the updated candle
 * 
 * @param asset Token symbol
 * @param price Current price
 * @param timestamp Server timestamp
 * @param timeframe Candle timeframe (default: 1m)
 * @returns Object indicating if candle was closed
 */
export async function processPriceTick(
  asset: string,
  price: Decimal,
  timestamp: Date = new Date(),
  timeframe: Timeframe = '1m'
): Promise<{ candleClosed: boolean; closedCandle?: OHLCCandle; currentCandle: OHLCCandle }> {
  const timestampMs = timestamp.getTime();
  const currentBucket = getBucketStart(timestampMs, timeframe);
  const priceStr = price.toString();
  
  // Get existing candle from cache
  const existingCandle = await getCurrentCandle(asset, timeframe);
  
  let candleClosed = false;
  let closedCandle: OHLCCandle | undefined;
  
  // Check if we need to close the previous candle
  if (existingCandle && existingCandle.bucketStart < currentBucket) {
    // Minute boundary crossed - persist the old candle
    await persistCandle(existingCandle);
    closedCandle = existingCandle;
    candleClosed = true;
  
  }
  
  // Calculate new candle or update existing
  let newCandle: OHLCCandle;
  
  if (!existingCandle || existingCandle.bucketStart < currentBucket) {
    // Start a new candle
    newCandle = {
      asset,
      timeframe,
      bucketStart: currentBucket,
      open: priceStr,
      high: priceStr,
      low: priceStr,
      close: priceStr,
      volume: '0',  // Volume tracking could be added later
    };
  } else {
    // Update existing candle
    const existingHigh = new Decimal(existingCandle.high);
    const existingLow = new Decimal(existingCandle.low);
    
    newCandle = {
      ...existingCandle,
      high: Decimal.max(existingHigh, price).toString(),
      low: Decimal.min(existingLow, price).toString(),
      close: priceStr,
    };
  }
  
  // Cache the updated candle
  await saveCurrentCandle(newCandle);
  
  return { candleClosed, closedCandle, currentCandle: newCandle };
}

/**
 * Get historical candles from PostgreSQL
 * 
 * @param asset Token symbol
 * @param timeframe Candle timeframe
 * @param limit Max number of candles to return
 * @param before Optional: only candles before this timestamp
 * @returns Array of candles ordered by bucketStart ASC
 */
export async function getHistoricalCandles(
  asset: string,
  timeframe: Timeframe = '1m',
  limit: number = 100,
  before?: Date
): Promise<OHLCCandle[]> {
  const db = getDb();
  
  const candles = await db.candles.findMany({
    where: {
      asset: asset.toUpperCase(),
      timeframe,
      ...(before ? { bucketStart: { lt: before } } : {}),
    },
    orderBy: { bucketStart: 'asc' },
    take: limit,
  });
  
  return candles.map((c:any) => ({
    asset: c.asset,
    timeframe: c.timeframe,
    bucketStart: c.bucketStart.getTime(),
    open: c.open.toString(),
    high: c.high.toString(),
    low: c.low.toString(),
    close: c.close.toString(),
    volume: c.volume.toString(),
  }));
}

/**
 * Get the latest N candles (most recent first, then reversed for charting)
 * Used by the API endpoint for chart data
 * 
 * @param asset Token symbol
 * @param timeframe Candle timeframe  
 * @param limit Number of candles
 * @returns Candles ordered by bucketStart ASC (oldest first)
 */
export async function getLatestCandles(
  asset: string,
  timeframe: Timeframe = '1m',
  limit: number = 100
): Promise<OHLCCandle[]> {
  const db = getDb();
  
  // Fetch most recent candles (descending), then reverse for chart
  const candles = await db.candles.findMany({
    where: {
      asset: asset.toUpperCase(),
      timeframe,
    },
    orderBy: { bucketStart: 'desc' },
    take: limit,
  });
  
  // Reverse to get oldest-first order for charting
  return candles.reverse().map((c:any) => ({
    asset: c.asset,
    timeframe: c.timeframe,
    bucketStart: c.bucketStart.getTime(),
    open: c.open.toString(),
    high: c.high.toString(),
    low: c.low.toString(),
    close: c.close.toString(),
    volume: c.volume.toString(),
  }));
}
