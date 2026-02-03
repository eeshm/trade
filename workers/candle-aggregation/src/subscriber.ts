/**
 * Price Subscription Handler
 * 
 * Subscribes to the price update pub/sub channel and processes
 * each price tick for candle aggregation.
 */

import { Decimal } from "decimal.js";
import { subscriber, redisKeys } from "@repo/redis";
import { processPriceTick } from "@repo/pricing";
import { publishCandleUpdate, type PriceUpdateEvent } from "@repo/events";

/**
 * Subscribe to price updates and process candles
 */
export async function subscribeToPrice(): Promise<void> {
  const channel = redisKeys.CHANNELS.priceUpdate();
  
  // Subscribe to the price update channel
  await subscriber.subscribe(channel, async (message: string) => {
    try {
      const priceEvent: PriceUpdateEvent = JSON.parse(message);
      
      // Process the price tick for candle aggregation
      const price = new Decimal(priceEvent.price);
      const timestamp = new Date(priceEvent.timestamp);
      
      const candleResult = await processPriceTick(
        priceEvent.symbol,
        price,
        timestamp,
        "1m"
      );
      
      // Broadcast current candle update for live charting
      await publishCandleUpdate({
        asset: candleResult.currentCandle.asset,
        timeframe: candleResult.currentCandle.timeframe,
        bucketStart: candleResult.currentCandle.bucketStart,
        open: candleResult.currentCandle.open,
        high: candleResult.currentCandle.high,
        low: candleResult.currentCandle.low,
        close: candleResult.currentCandle.close,
        volume: candleResult.currentCandle.volume,
        isComplete: false,
      });
      
      // If a candle was closed, also broadcast it as complete
      if (candleResult.candleClosed && candleResult.closedCandle) {
        await publishCandleUpdate({
          asset: candleResult.closedCandle.asset,
          timeframe: candleResult.closedCandle.timeframe,
          bucketStart: candleResult.closedCandle.bucketStart,
          open: candleResult.closedCandle.open,
          high: candleResult.closedCandle.high,
          low: candleResult.closedCandle.low,
          close: candleResult.closedCandle.close,
          volume: candleResult.closedCandle.volume,
          isComplete: true,
        });
        
      }
    } catch (error) {
      console.error("[CANDLE-WORKER] Error processing price update:", error);
      // Don't rethrow - continue processing other messages
    }
  });
  
}
