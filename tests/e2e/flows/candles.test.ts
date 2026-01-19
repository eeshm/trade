import { afterAll, beforeAll, describe, expect, test } from "vitest";
import { getApiClient, shutdownApiClient } from "../setup/testServer.ts";
import { setTestPrice } from "../helpers/price.ts";
import { 
  processTestPriceTick, 
  getTestCurrentCandle, 
  getTestBucketStart 
} from "../helpers/candles.ts";
import type { SuperTest, Test } from "supertest";

/**
 * Candle Aggregation E2E Tests
 * 
 * Tests the OHLC candle aggregation system:
 * 1. Candle creation from price ticks
 * 2. OHLC value updates (high/low/close)
 * 3. Candle closure on minute boundary
 * 4. GET /market/candles API endpoint
 * 5. Redis caching of current candle
 */

describe("Candle Aggregation (E2E)", () => {
  let api: SuperTest<Test>;
  // Use a base timestamp far in the future to avoid Redis state conflicts
  const baseTimestamp = new Date("2030-06-15T12:00:00.000Z").getTime();
  let testMinuteOffset = 0;

  // Get a unique minute for each test
  const getUniqueTestTime = () => {
    testMinuteOffset++;
    return new Date(baseTimestamp + testMinuteOffset * 60000);
  };

  beforeAll(async () => {
    api = await getApiClient();
    // Seed initial SOL price
    await setTestPrice("SOL", "100.00");
  });

  afterAll(async () => {
    await shutdownApiClient();
  });

  describe("Price Tick Processing", () => {
    test("creates new candle on first price tick", async () => {
      const now = getUniqueTestTime();
      const result = await processTestPriceTick("SOL", "150.50", now);

      expect(result.currentCandle).toBeDefined();
      expect(result.currentCandle.asset).toBe("SOL");
      expect(result.currentCandle.timeframe).toBe("1m");
      // Use parseFloat comparison to handle decimal formatting differences
      expect(parseFloat(result.currentCandle.open)).toBe(150.50);
      expect(parseFloat(result.currentCandle.high)).toBe(150.50);
      expect(parseFloat(result.currentCandle.low)).toBe(150.50);
      expect(parseFloat(result.currentCandle.close)).toBe(150.50);
      expect(result.candleClosed).toBe(false);
    });

    test("updates high when price increases", async () => {
      const now = getUniqueTestTime();
      
      // First tick at 150
      await processTestPriceTick("SOL", "150.00", now);
      
      // Second tick at 160 (higher) - same minute
      const result = await processTestPriceTick("SOL", "160.00", now);

      expect(parseFloat(result.currentCandle.high)).toBe(160);
      expect(parseFloat(result.currentCandle.close)).toBe(160);
    });

    test("updates low when price decreases", async () => {
      const now = getUniqueTestTime();
      
      // First tick at 150
      await processTestPriceTick("SOL", "150.00", now);
      
      // Lower tick - same minute
      const result = await processTestPriceTick("SOL", "140.00", now);

      expect(parseFloat(result.currentCandle.low)).toBe(140);
      expect(parseFloat(result.currentCandle.close)).toBe(140);
    });

    test("preserves open price through multiple ticks", async () => {
      const now = getUniqueTestTime();
      
      // First tick sets open
      const first = await processTestPriceTick("SOL", "200.00", now);
      expect(parseFloat(first.currentCandle.open)).toBe(200);
      
      // Subsequent ticks in same minute shouldn't change open
      await processTestPriceTick("SOL", "210.00", now);
      await processTestPriceTick("SOL", "195.00", now);
      const result = await processTestPriceTick("SOL", "205.00", now);

      expect(parseFloat(result.currentCandle.open)).toBe(200);
    });
  });

  describe("Candle Closure", () => {
    test("closes candle when minute boundary is crossed", async () => {
      // Get a unique minute for this test
      const minute1 = getUniqueTestTime();
      const minute2 = new Date(minute1.getTime() + 60000);
      
      // Process first tick in minute 1
      const firstResult = await processTestPriceTick("SOL", "100.00", minute1);
      expect(firstResult.candleClosed).toBe(false); // First tick, no previous candle to close
      
      // Process tick in minute 2 - should close minute 1 candle
      const secondResult = await processTestPriceTick("SOL", "105.00", minute2);

      // The minute 1 candle should be closed
      expect(secondResult.candleClosed).toBe(true);
      expect(secondResult.closedCandle).toBeDefined();
      expect(parseFloat(secondResult.closedCandle!.close)).toBe(100);
      
      // New candle should start with new price
      expect(parseFloat(secondResult.currentCandle.open)).toBe(105);
    });
  });

  describe("Redis Candle Cache", () => {
    test("caches current candle in Redis", async () => {
      const now = getUniqueTestTime();
      await processTestPriceTick("SOL", "175.00", now);

      const cachedCandle = await getTestCurrentCandle("SOL", "1m");

      expect(cachedCandle).not.toBeNull();
      expect(cachedCandle.asset).toBe("SOL");
      expect(parseFloat(cachedCandle.close)).toBe(175);
    });
  });

  describe("GET /market/candles", () => {
    test("returns candle data with correct structure", async () => {
      const res = await api.get("/market/candles").query({
        asset: "SOL",
        timeframe: "1m",
        limit: 10,
      });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.asset).toBe("SOL");
      expect(res.body.timeframe).toBe("1m");
      expect(Array.isArray(res.body.candles)).toBe(true);
    });

    test("returns candles with OHLCV fields", async () => {
      // First ensure we have some candle data
      const now = getUniqueTestTime();
      await processTestPriceTick("SOL", "123.45", now);

      const res = await api.get("/market/candles").query({
        asset: "SOL",
        timeframe: "1m",
        limit: 10,
      });

      expect(res.status).toBe(200);
      
      // Current candle should be included
      if (res.body.currentCandle) {
        expect(res.body.currentCandle).toHaveProperty("bucketStart");
        expect(res.body.currentCandle).toHaveProperty("open");
        expect(res.body.currentCandle).toHaveProperty("high");
        expect(res.body.currentCandle).toHaveProperty("low");
        expect(res.body.currentCandle).toHaveProperty("close");
        expect(res.body.currentCandle).toHaveProperty("volume");
      }
    });

    test("respects limit parameter", async () => {
      const res = await api.get("/market/candles").query({
        asset: "SOL",
        timeframe: "1m",
        limit: 5,
      });

      expect(res.status).toBe(200);
      expect(res.body.candles.length).toBeLessThanOrEqual(5);
    });

    test("validates timeframe parameter", async () => {
      const res = await api.get("/market/candles").query({
        asset: "SOL",
        timeframe: "invalid",
        limit: 10,
      });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.code).toBe("INVALID_TIMEFRAME");
    });

    test("defaults to SOL and 1m if no params", async () => {
      const res = await api.get("/market/candles");

      expect(res.status).toBe(200);
      expect(res.body.asset).toBe("SOL");
      expect(res.body.timeframe).toBe("1m");
    });

    test("limits max candles to 500", async () => {
      const res = await api.get("/market/candles").query({
        asset: "SOL",
        timeframe: "1m",
        limit: 1000, // Request more than max
      });

      expect(res.status).toBe(200);
      // The backend should cap at 500
      expect(res.body.count).toBeLessThanOrEqual(500);
    });
  });

  describe("Bucket Calculation", () => {
    test("getBucketStart aligns to minute boundary", () => {
      // 10:30:45.123 should align to 10:30:00.000
      const timestamp = new Date("2024-01-15T10:30:45.123Z").getTime();
      const expected = new Date("2024-01-15T10:30:00.000Z").getTime();
      
      const result = getTestBucketStart(timestamp, 60000);
      expect(result).toBe(expected);
    });

    test("getBucketStart works for 5-minute timeframe", () => {
      // 10:37:45 should align to 10:35:00 for 5m candles
      const timestamp = new Date("2024-01-15T10:37:45.000Z").getTime();
      const expected = new Date("2024-01-15T10:35:00.000Z").getTime();
      
      const result = getTestBucketStart(timestamp, 5 * 60000);
      expect(result).toBe(expected);
    });
  });
});
