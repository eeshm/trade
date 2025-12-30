/**
 * Pricing Module
 * Server-side price management for trading
 * 
 * Prices are:
 * - Stored in Redis (fast reads)
 * - Updated by price ingestion worker (future)
 * - Never trusted from client
 * - Always timestamped on server (audit trail)
 */

// Constants
export { 
  PRICE_STALE_THRESHOLD_MS, 
  DEV_PRICES, 
  SUPPORTED_SYMBOLS,
  type SupportedSymbol,
} from './constants.js';

// Read operations
export { 
  getPrice, 
  getPriceWithMetadata, 
  hasPriceAvailable,
} from './getPrice.js';

// Write operations
export { 
  setPrice, 
  setPrices,
} from './setPrice.js';

// Development utilities
export { 
  seedDevelopmentPrices, 
  seedTestPrice,
} from './seed.js';