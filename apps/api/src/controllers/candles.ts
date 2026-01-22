import type { Request, Response } from "express";
import { getLatestCandles, getCurrentCandle, type Timeframe } from "@repo/pricing";

/**
 * GET /market/candles
 * Fetch historical OHLC candles for charting
 *
 * Query params:
 * - asset: Token symbol (default: SOL)
 * - timeframe: Candle timeframe (default: 1m)
 * - limit: Number of candles (default: 100, max: 500)
 *
 * Response:
 * {
 *   success: true,
 *   asset: 'SOL',
 *   timeframe: '1m',
 *   candles: [
 *     { bucketStart: 1705123200000, open: '230.50', high: '231.00', low: '230.00', close: '230.75', volume: '0' },
 *     ...
 *   ],
 *   currentCandle?: { ... } // Optional: current open candle from Redis
 * }
 */
export async function getCandlesHandler(req: Request, res: Response) {
  try {
    const asset = (req.query.asset as string)?.toUpperCase() || "SOL";
    const timeframe = (req.query.timeframe as Timeframe) || "1m";
    const limitParam = parseInt(req.query.limit as string) || 100;
    
    // Validate timeframe
    const validTimeframes: Timeframe[] = ["1m", "5m", "15m", "1h"];
    if (!validTimeframes.includes(timeframe)) {
      res.status(400).json({
        success: false,
        error: `Invalid timeframe: ${timeframe}. Valid options: ${validTimeframes.join(", ")}`,
        code: "INVALID_TIMEFRAME",
      });
      return;
    }

    // Validate limit (max 1000 to prevent abuse)
    const limit = Math.min(Math.max(1, limitParam), 1000);

    // Fetch historical candles from PostgreSQL
    const candles = await getLatestCandles(asset, timeframe, limit);

    // Optionally include current open candle from Redis
    const currentCandle = await getCurrentCandle(asset, timeframe);

    res.status(200).json({
      success: true,
      asset,
      timeframe,
      count: candles.length,
      candles: candles.map(c => ({
        bucketStart: c.bucketStart,
        open: c.open,
        high: c.high,
        low: c.low,
        close: c.close,
        volume: c.volume,
      })),
      currentCandle: currentCandle ? {
        bucketStart: currentCandle.bucketStart,
        open: currentCandle.open,
        high: currentCandle.high,
        low: currentCandle.low,
        close: currentCandle.close,
        volume: currentCandle.volume,
      } : null,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";

    console.error("Error fetching candles:", error);

    res.status(500).json({
      success: false,
      error: message,
      code: "INTERNAL_ERROR",
    });
  }
}
