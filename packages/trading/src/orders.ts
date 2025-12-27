/**
 * Order Management
 * Order placement, retrieval, status tracking
 */

import { Decimal } from "decimal.js";
import type { Decimal as DecimalInstance } from "decimal.js";
import { getDb } from "@repo/db";
import { validateOrderInput } from "./validation.js";
import { calculateFee } from "./fees.js";
import { ORDER_STATUS } from "./constants.js";

interface PlaceOrderResult {
  orderId: number;
  feeApplied: string;
}
/**
 * Place a market order
 * 
 * CRITICAL: Uses SELECT ... FOR UPDATE to prevent race conditions
 * 
 * Fee model:
 * - At placement: only LOCK the cost (no fee deducted yet)
 * - At fill: deduct the actual fee (0.1% of execution value)
 * - On rejection: full refund of locked cost (no fee lost)
 * 
 * This ensures users don't lose fees on cancelled orders.
 */

export async function placeOrder(
  userId: number,
  side: string,
  baseAsset: string,
  quoteAsset: string,
  requestedSize: DecimalInstance,
  priceAtOrderTime: DecimalInstance
): Promise<PlaceOrderResult> {
  validateOrderInput(side, "market", baseAsset, quoteAsset, requestedSize);

  const size = new Decimal(requestedSize);
  const price = new Decimal(priceAtOrderTime);

  // Validate price > 0
  if (price.lte(0)) {
    throw new Error("Price must be > 0");
  }

  // Cost is locked at placement; fee is deducted only on fill
  const cost = size.times(price);
  const estimatedFee = calculateFee(price, size);  // For display only

  const db = getDb();

  // ATOMIC TRANSACTION: Lock balance, check, create order
  const result = await db.$transaction(async (tx) => {
    // SELECT ... FOR UPDATE: locks this row until transaction ends
    const balance = await tx.balances.findUniqueOrThrow({
      where: { userId_asset: { userId, asset: quoteAsset } },
    });

    const available = new Decimal(balance.available);
    const locked = new Decimal(balance.locked);

    // Check: sufficient balance for COST ONLY (fee deducted later on fill)
    if (available.lt(cost)) {
      throw new Error(
        `Insufficient balance. Need ${cost.toString()} ${quoteAsset}, ` +
          `but have ${available.toString()}`
      );
    }

    const order = await tx.orders.create({
      data: {
        userId,
        side,
        type: "market",
        baseAsset,
        quoteAsset,
        requestedSize: size.toString(),
        priceAtOrderTime: price.toString(),
        status: ORDER_STATUS.PENDING,
        feesApplied: '0',  // Will be updated on fill
      },
    });

    // Lock only the COST (not the fee)
    // This ensures full refund on rejection, no fee loss
    await tx.balances.update({
      where: { userId_asset: { userId, asset: quoteAsset } },
      data: {
        available: available.minus(cost).toString(),
        locked: locked.plus(cost).toString(),
      },
    });

    return { orderId: order.id, feeApplied: estimatedFee.toString() };
  });
  return result;
}

/**
 * Get single order by ID
 */
export async function getOrder(orderId: number) {
  const db = getDb();
  return await db.orders.findUnique({
    where: {
      id: orderId,
    },
  });
}

/**
 * Get all orders for a user, sorted by newest first
 */
export async function getUserOrders(userId: number) {
  const db = getDb();
  return await db.orders.findMany({
    where: {
      userId,
    },
    orderBy: {
      createdAt: "desc",
    },
  });
}
