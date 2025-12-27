/**
 * Position Tracking
 * Manages user holdings of assets (SOL)
 */

import {Decimal} from "decimal.js";
import type { Decimal as DecimalInstance } from "decimal.js";
import { getDb } from "@repo/db";

/**
 * Initialize a position for a user asset
 * Creates position with size=0, avgEntryPrice=0
 * Called during portfolio setup
 */
export async function initPosition(
  userId: number,
  asset: string
): Promise<void> {
  const db = getDb();

  // Check if position already exists
  const existing = await db.positions.findUnique({
    where: {
      userId_asset: {
        userId,
        asset,
      },
    },
  });

  if (existing) {
    return; // Position already exists
  }
  // Create new position
  await db.positions.create({
    data: {
      userId,
      asset,
      size: '0',           
      avgEntryPrice: '0',  
    },
  });
}
/**
 * Update position after trade execution (called within db.$transaction())
 * On buy: increase size, recalculate avg entry price
 * On sell: decrease size, keep avg entry price
 * Invariant: size >= 0 always
 * @param tx Prisma transaction context (NOT db!)
 */
export async function updatePosition(
  tx: any,  // Prisma transaction context for atomicity
  userId: number,
  asset: string,
  side: "buy" | "sell",
  executedPrice: DecimalInstance,
  executedSize: DecimalInstance
): Promise<void> {
  const position = await tx.positions.findUniqueOrThrow({
    where: {
      userId_asset: {
        userId,
        asset,
      },
    },
  });
  const price = new Decimal(executedPrice);
  const size = new Decimal(executedSize);
  const currentAvg = new Decimal(position.avgEntryPrice);
  const currentSize = new Decimal(position.size);

  let newSize: Decimal;
  let newAvg: Decimal;
  if (side === "buy") {
    newSize = currentSize.plus(size);
    
    // Sanity check: size must be positive after buy
    if (newSize.lte(0)) {
      throw new Error(
        `Invalid position size after buy: ${newSize}. ` +
        `oldSize=${currentSize}, buySize=${size}`
      );
    }
    
    // Recalculate weighted average entry price
    if (currentSize.isZero()) {
      // First buy: cost basis = execution price
      newAvg = price;
    } else {
      // Pyramid: newAvg = (oldAvg * oldSize + price * newSize) / (oldSize + newSize)
      newAvg = currentAvg
        .times(currentSize)
        .plus(price.times(size))
        .dividedBy(newSize);
    }
  } else {
    newSize = currentSize.minus(size);

    // Invariant: size cannot go negative
    if (newSize.isNegative()) {
      throw new Error(
        `Position update error: selling ${size} but only own ${currentSize} ` +
          `for user ${userId} asset ${asset}`
      );
    }
    
    // FIX: Reset avgEntryPrice to 0 if position fully closed
    if (newSize.isZero()) {
      newAvg = new Decimal('0');  // Clear cost basis on full close
    } else {
      newAvg = currentAvg;  // Keep avg for partial close (P&L tracking)
    }
  }

  await tx.positions.update({
    where: { userId_asset: { userId, asset } },
    data: {
      size: newSize.toString(),      // String preserves exact decimal precision
      avgEntryPrice: newAvg.toString(), // String preserves exact decimal precision
    },
  });
}
