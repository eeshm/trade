/**
 * Common Validation Schemas
 *
 * Reusable schemas for wallet addresses, decimals, etc.
 */

import { z } from "zod";

/**
 * Solana wallet address (base58, 32-44 chars)
 */

export const walletAddressSchema = z
  .string()
  .min(32, "Wallet address too short")
  .max(44, "Wallet address too long")
  .regex(/^[1-9A-HJ-NP-Za-km-z]+$/, "Invalid base58 wallet address");

/**
 * Positive decimal string (e.g. "0.001", "100")
 * Used for amounts, prices, sizes.
 */

export const positiveDecimalSchema = z
  .string()
  .regex(/^\d+(\.\d+)?$/, "Invalid decimal format")
  .refine((val) => parseFloat(val) > 0, { message: "Value must be positive" });

/**
 * Non-negative decimal string (e.g. "0", "0.0", "100")
 */
export const nonNegativeDecimalSchema = z
  .string()
  .regex(/^\d+(\.\d+)?$/, "Invalid decimal format")
  .refine((val) => parseFloat(val) >= 0, {
    message: "Value must be non-negative",
  });

/** Positive integer schema
 * For Ids, counts, etc.
 */
export const positiveIntSchema = z
  .string()
  .regex(/^\d+$/, "Must be a positive integer")
  .transform((val) => parseInt(val, 10))
  .refine((val) => val > 0, "Must be greater than 0");

/**
 * Supported trading pairs
 */
export const assetSchema = z.enum(["SOL", "USD", "USDC"], {
  error: "Asset must be one of: SOL, USD, USDC",
});

/**
 * Order side schema
 */
export const orderSideSchema = z.enum(["buy", "sell"], {
  error: "Order side must be 'buy' or 'sell'",
});

/**
 * Token Symbol for market data
 */
export const symbolSchema = z
  .string()
  .min(1, "Token symbol too short")
  .max(10, "Token symbol too long")
  .transform((val) => val.toUpperCase())
  .refine((val) => ["SOL", "BTC", "ETH", "USD", "USDC"].includes(val), {
    message: "Unsupported token symbol",
  });
