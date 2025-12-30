/**
 * Development Price Seeding
 * Seeds mock prices for local development/testing
 * 
 * WARNING: Never use in production - prices come from oracles
 */

import { Decimal } from 'decimal.js';
import { DEV_PRICES } from './constants.js';
import { setPrice } from './setPrice.js';

/**
 * Seed development prices
 * Called on API startup in non-production environments
 */
export async function seedDevelopmentPrices(): Promise<void> {
  if (process.env.NODE_ENV === 'production') {
    console.warn('seedDevelopmentPrices called in production - skipping');
    return;
  }

  for (const [symbol, priceStr] of Object.entries(DEV_PRICES)) {
    await setPrice(symbol, new Decimal(priceStr));
  }

  console.log('✓ Seeded development prices:', DEV_PRICES);
}

/**
 * Seed a custom price (for testing specific scenarios)
 * 
 * @param symbol Token symbol
 * @param price Price to set
 */
export async function seedTestPrice(symbol: string, price: string | number): Promise<void> {
  if (process.env.NODE_ENV === 'production') {
    throw new Error('seedTestPrice cannot be used in production');
  }

  await setPrice(symbol, new Decimal(price));
}