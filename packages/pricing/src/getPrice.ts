/**
 * Price Retrieval
 * Read prices from Redis with staleness validation
 */

import { Decimal } from 'decimal.js';
import { client as redis, redisKeys } from '@repo/redis';
import { PRICE_STALE_THRESHOLD_MS } from './constants.js';

interface PriceWithMetadata {
    price: Decimal;
    timestamp: Date;
    ageMs: number;
}


/**
 * Get current price for a symbol
 * 
 * @param symbol Token symbol (e.g., 'SOL')
 * @throws Error if price not found or stale
 * @returns Price as Decimal
 */

export async function getPrice(symbol:string) : Promise<Decimal> {

    const upperSymbol = symbol.toUpperCase();
    const priceKey = redisKeys.PRICE.tokenPrice(upperSymbol);
    const timestampKey =  `${priceKey}:ts`;

    // Get price and timestamp atomically

    const [priceStr, timestampStr]=  await Promise.all([
        redis.get(priceKey),
        redis.get(timestampKey),
    ]);


    if(!priceStr){
        throw new Error(`Price not available for ${upperSymbol}`);
    }

    if(timestampStr){
        const priceTime = new Date(timestampStr).getTime();
        const now = Date.now();
        const ageMs = now - priceTime;

        if(ageMs > PRICE_STALE_THRESHOLD_MS){
            throw new Error(`
                Price for ${upperSymbol} is stale (${Math.round(ageMs/1000)}s old).` + 
            `Max allowed: ${PRICE_STALE_THRESHOLD_MS/1000}s`)
        }
    }
    return new Decimal(priceStr);
}

/**
 * Get price with metadata (for debugging/display)
 * 
 * @param symbol Token symbol
 * @returns Price, timestamp, and age; null if unavailable or stale
 */

export async function getPriceWithMetadata(symbol:string) {
    const upperSymbol =  symbol.toUpperCase();
    const priceKey =  redisKeys.PRICE.tokenPrice(upperSymbol);
    const timestampKey =  `${priceKey}:ts`;

    const [priceStr, timestampStr]=  await Promise.all([
        redis.get(priceKey),
        redis.get(timestampKey),
    ]);

    if(!priceStr){
        return null;
    }

    const timestamp = timestampStr ? new Date(timestampStr) : new Date();
    const ageMs = Date.now() - timestamp.getTime();

    // Check staleness
    if(ageMs > PRICE_STALE_THRESHOLD_MS){
        return null;
    }

    return{
        price : new Decimal(priceStr),
        timestamp,
        ageMs
    }
}

/**
 * Check if price is available (non-throwing version)
 * 
 * @param symbol Token symbol
 * @returns true if price exists and is fresh
 */
export async function hasPriceAvailable(symbol:string) {
    try {
        await getPrice(symbol);
    } catch (error) {
        return false;
    }
}