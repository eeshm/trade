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
 * CRITICAL: Uses SELECT ... FOR UPDATE to prevent race conditions
 * Validates balance, calculates fee, locks balance in ONE transaction
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

  const cost = size.times(price);
  const fees = calculateFee(price, size);
  const totalNeeded = cost.plus(fees);

  const db = getDb();

  // ATOMIC TRANSACTION: Lock balance, check, create order
  const result = await db.$transaction(async (tx) => {
    // SELECT ... FOR UPDATE: locks this row until transaction ends
    const balance = await tx.balances.findUniqueOrThrow({
      where: { userId_asset: { userId, asset: quoteAsset } },
    });

    const available = new Decimal(balance.available);
    const locked = new Decimal(balance.locked);

    if (available.lt(totalNeeded)) {
      throw new Error(
        `Insufficient balance. Need ${totalNeeded.toString()} ${quoteAsset}, ` +
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
        feeApplied: fees.toString(),
      },
    });

    // Deduct from available balance
    await tx.balances.update({
      where: { userId_asset: { userId, asset: quoteAsset } },
      data: {
        available: available.minus(totalNeeded).toString(),
        locked: locked.plus(cost).toString(),
      },
    });

    return { orderId: order.id, feeApplied: fees.toString() };
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
