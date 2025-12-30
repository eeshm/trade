/**
 * Pricing Constants
 * Thresholds and development values
 * Just using SOL
 */

// Price staleness threshold (5 minutes in milliseconds)
export const PRICE_STALE_THRESHOLD_MS = 5 * 60 * 1000;

// Development seed prices (used when NODE_ENV !== 'production')
export const DEV_PRICES: Record<string, string> = {
  SOL: '230.50',
};

// Supported symbols (for validation)
export const SUPPORTED_SYMBOLS = ['SOL'] as const;
export type SupportedSymbol = (typeof SUPPORTED_SYMBOLS)[number];