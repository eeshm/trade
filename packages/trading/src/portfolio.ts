/**
 * Portfolio Management
 * Portfolio initialization and retrieval
 */

import { Decimal } from "decimal.js";
import { getDb } from "@repo/db";
import { ASSETS, INITIAL_BALANCE } from "./constants.js";

interface Balance {
  asset: string;
  available: string;
  locked: string;
}

interface Position {
  asset: string;
  size: string;
  avgEntryPrice: string;
}

interface Portfolio {
  userId: number;
  balances: Balance[];
  positions: Position[];
  openOrders: any[];
}

/**
 * Initialize portfolio for a new user
 * Creates initial balances (from INITIAL_BALANCE constant) and SOL position
 * Called from auth.createOrGetUser() during user registration
 * 
 * Invariants:
 * - Each user has ONE balance per asset
 * - Each user has ONE position per asset
 * - Idempotent: Safe to call multiple times (no error on duplicate)
 * 
 * Atomicity: All balances + positions created in single transaction
 * Fail fast: Throws if INITIAL_BALANCE is invalid
 */
export async function initPortfolio(userId: number): Promise<void> {
  const db = getDb();

  // Atomic transaction with advisory lock to prevent race conditions
  // during concurrent user creation
  await db.$transaction(async (tx) => {
    // Use advisory lock to serialize portfolio initialization per user
    // This prevents race conditions when two logins happen concurrently
    // Cast to integer to avoid void return type issue with Prisma
    await tx.$queryRaw`SELECT pg_advisory_xact_lock(${userId}::bigint)::text`;

    // Check if portfolio already initialized (inside transaction)
    const existing = await tx.balances.findFirst({
      where: { userId },
    });
    
    if (existing) {
      return;
    }
    // Create initial balances for all assets
    for (const [asset, initialBalance] of Object.entries(INITIAL_BALANCE)) {
      // Validate balance is valid Decimal-compatible value (string or number)
      let balanceStr: string;
      try {
        // Decimal.js constructor accepts strings, numbers, or Decimal objects
        balanceStr = new Decimal(initialBalance).toString();
        
        // Validate it's not NaN or Infinity
        if (balanceStr === 'NaN' || balanceStr === 'Infinity') {
          throw new Error(`Balance is ${balanceStr}`);
        }
      } catch (error) {
        throw new Error(
          `Invalid INITIAL_BALANCE for ${asset}: ` +
          `'${initialBalance}' cannot be converted to Decimal. ` +
          `Error: ${error instanceof Error ? error.message : String(error)}`
        );
      }

      await tx.balances.create({
        data: {
          userId,
          asset,
          available: balanceStr,
          locked: "0",
        },
      });
    }

    // Create initial position for SOL
    await tx.positions.create({
      data: {
        userId,
        asset: ASSETS.SOL,
        size: "0",       
        avgEntryPrice: "0",
      },
    });
  });
}

export async function getPortfolio(userId: number): Promise<Portfolio> {
  const db = getDb();

  // Fetch balances, positions, and open orders in parallel
  const [balances, positions, openOrders] = await Promise.all([
    db.balances.findMany({
      where: { userId },
      orderBy: { asset: "asc" },  
    }),
    db.positions.findMany({
      where: { userId },
      orderBy: { asset: "asc" },
    }),
    db.orders.findMany({
      where: { userId, status: "pending" },
      orderBy: { createdAt: "desc" },
    }),
  ]);

  return {
    userId,
    balances: balances.map((b) => ({
      asset: b.asset,
      available: b.available.toString(),  
      locked: b.locked.toString(),
    })),
    positions: positions.map((p) => ({
      asset: p.asset,
      size: p.size.toString(),              
      avgEntryPrice: p.avgEntryPrice.toString(),
    })),
    openOrders,
  };
}
