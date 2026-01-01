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
  executedSize: string;
  executedPrice: string;
  feesApplied: string;
  status: string;
}

/**
 * Place and execute a market order immediately
 * 
 * Market orders execute instantly at market price. No pending state.
 * 
 * Flow:
 * 1. Validate input
 * 2. Lock balance for order cost
 * 3. Create order (status: FILLED)
 * 4. Execute trade (create trade record, update balances + positions)
 * 5. Return execution details
 * 
 * CRITICAL: Entire flow is atomic via Prisma transaction.
 * Prevents race conditions and ensures ledger consistency.
 */

export async function placeOrder(
  userId: number,
  side: string,
  baseAsset: string,
  quoteAsset: string,
  requestedSize: DecimalInstance,
  executionPrice: DecimalInstance
): Promise<PlaceOrderResult> {
  validateOrderInput(side, "market", baseAsset, quoteAsset, requestedSize);

  const size = new Decimal(requestedSize);
  const price = new Decimal(executionPrice);

  // Validate price > 0
  if (price.lte(0)) {
    throw new Error("Price must be > 0");
  }

  const cost = size.times(price);
  const fee = calculateFee(price, size);

  const db = getDb();

  // ATOMIC TRANSACTION: Create order + execute trade all at once
  const result = await db.$transaction(async (tx) => {
    // SELECT ... FOR UPDATE: locks balance row until transaction ends
    const balance = await tx.balances.findUniqueOrThrow({
      where: { userId_asset: { userId, asset: quoteAsset } },
    });

    const available = new Decimal(balance.available);
    const locked = new Decimal(balance.locked);

    // Check: sufficient balance for cost + fee
    const totalNeeded = cost.plus(fee);
    if (available.lt(totalNeeded)) {
      throw new Error(
        `Insufficient balance. Need ${totalNeeded.toString()} ${quoteAsset} ` +
          `(cost: ${cost.toString()} + fee: ${fee.toString()}), ` +
          `but have ${available.toString()}`
      );
    }

    // 1. Create order with FILLED status (market orders execute immediately)
    const order = await tx.orders.create({
      data: {
        userId,
        side,
        type: "market",
        baseAsset,
        quoteAsset,
        requestedSize: size.toString(),
        priceAtOrderTime: price.toString(),
        status: ORDER_STATUS.FILLED,  // Market orders filled immediately
        feesApplied: fee.toString(),
      },
    });

    // 2. Create trade record
    await tx.trades.create({
      data: {
        orderId: order.id,
        userId,
        side,
        executedPrice: price.toString(),
        executedSize: size.toString(),
        fee: fee.toString(),
      },
    });

    // 3. Update quote asset balance (always updated for all order types)
    if (side === "buy") {
      // BUY: Deduct cost + fee from available
      const newAvailable = available.minus(cost).minus(fee);
      await tx.balances.update({
        where: {
          userId_asset: { userId, asset: quoteAsset },
        },
        data: {
          available: newAvailable.toString(),
          locked: locked.toString(),
        },
      });
    } else {
      // SELL: Add proceeds (price * size - fee) to available
      const proceeds = price.times(size).minus(fee);
      const newAvailable = available.plus(proceeds);
      await tx.balances.update({
        where: {
          userId_asset: { userId, asset: quoteAsset },
        },
        data: {
          available: newAvailable.toString(),
          locked: locked.toString(),
        },
      });
    }

    // 4. Update base asset position
    let baseBalance = await tx.balances.findUnique({
      where: {
        userId_asset: { userId, asset: baseAsset },
      },
    });

    if (!baseBalance) {
      // Initialize base asset balance if not exists
      baseBalance = await tx.balances.create({
        data: {
          userId,
          asset: baseAsset,
          available: "0",
          locked: "0",
        },
      });
    }

    const baseAvailable = new Decimal(baseBalance.available);
    const baseLocked = new Decimal(baseBalance.locked);

    if (side === "buy") {
      // BUY: Add to available
      const newAvailable = baseAvailable.plus(size);
      await tx.balances.update({
        where: {
          userId_asset: { userId, asset: baseAsset },
        },
        data: {
          available: newAvailable.toString(),
          locked: baseLocked.toString(),
        },
      });
    } else {
      // SELL: Deduct from available
      if (baseAvailable.lt(size)) {
        throw new Error(
          `Insufficient ${baseAsset} to sell. Have ${baseAvailable.toString()}, need ${size.toString()}`
        );
      }
      const newAvailable = baseAvailable.minus(size);
      await tx.balances.update({
        where: {
          userId_asset: { userId, asset: baseAsset },
        },
        data: {
          available: newAvailable.toString(),
          locked: baseLocked.toString(),
        },
      });
    }

    // 5. Update position
    let position = await tx.positions.findUnique({
      where: {
        userId_asset: { userId, asset: baseAsset },
      },
    });

    if (!position) {
      // Initialize position
      position = await tx.positions.create({
        data: {
          userId,
          asset: baseAsset,
          size: "0",
          avgEntryPrice: "0",
        },
      });
    }

    const posSize = new Decimal(position.size);
    const posAvg = new Decimal(position.avgEntryPrice);

    let newSize: DecimalInstance;
    let newAvg: DecimalInstance;

    if (side === "buy") {
      newSize = posSize.plus(size);
      // Update average entry price
      newAvg = posSize.isZero()
        ? price
        : posSize.times(posAvg).plus(price.times(size)).dividedBy(newSize);
    } else {
      newSize = posSize.minus(size);
      // Reset avg entry price if position closed
      newAvg = newSize.isZero() ? new Decimal(0) : posAvg;
    }

    await tx.positions.update({
      where: {
        userId_asset: { userId, asset: baseAsset },
      },
      data: {
        size: newSize.toString(),
        avgEntryPrice: newAvg.toString(),
      },
    });

    return {
      orderId: order.id,
      executedSize: size.toString(),
      executedPrice: price.toString(),
      feesApplied: fee.toString(),
      status: ORDER_STATUS.FILLED,
    };
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
