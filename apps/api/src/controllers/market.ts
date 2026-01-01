import type { Request, Response } from "express";
import { getPrice, getPriceWithMetadata } from "@repo/pricing";

/**
 * GET /market/price/:symbol
 * Fetch current market price for a symbol
 *
 * Response (on success):
 * {
 *   success: true,
 *   symbol: 'SOL',
 *   price: '230.50',
 *   timestamp: 1704067200000,
 *   ageMs: 1234
 * }
 *
 * Response (on failure - stale or missing):
 * {
 *   success: false,
 *   error: "Price unavailable or stale",
 *   code: "PRICE_UNAVAILABLE"
 * }
 */
export async function getPriceHandler(req: Request, res: Response) {
  try {
    const { symbol } = req.params;

    if (!symbol) {
      res.status(400).json({
        success: false,
        error: "Missing symbol parameter",
      });
      return;
    }

    const metadata = await getPriceWithMetadata(symbol.toUpperCase());

    if (!metadata) {
      res.status(503).json({
        success: false,
        error: "Price unavailable or stale",
        code: "PRICE_UNAVAILABLE",
      });
      return;
    }

    res.status(200).json({
      success: true,
      symbol: symbol.toUpperCase(),
      price: metadata.price.toString(),
      timestamp: metadata.timestamp.getTime(),
      ageMs: metadata.ageMs,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";

    res.status(400).json({
      success: false,
      error: message,
    });
  }
}

/**
 * GET /market/status
 * Fetch market data availability status
 *
 * Response:
 * {
 *   success: true,
 *   markets: [
 *     { symbol: 'SOL', available: true, ageMs: 1234 },
 *     { symbol: 'USD', available: true, ageMs: 5678 }
 *   ]
 * }
 */
export async function getMarketStatusHandler(req: Request, res: Response) {
  try {
    const symbols = ["SOL", "USD"];
    const markets = await Promise.all(
      symbols.map(async (symbol) => {
        try {
          const metadata = await getPriceWithMetadata(symbol);
          return {
            symbol,
            available: !!metadata,
            ageMs: metadata?.ageMs ?? -1,
          };
        } catch {
          return {
            symbol,
            available: false,
            ageMs: -1,
          };
        }
      })
    );

    res.status(200).json({
      success: true,
      markets,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";

    res.status(400).json({
      success: false,
      error: message,
    });
  }
}
