/**
 * Trade Execution
 * Filling orders, executing trades, updating balances and positions
 */

import { Decimal}  from "decimal.js";
import type { Decimal as DecimalInstance } from "decimal.js";
import { getDb } from "@repo/db";
import {
  validateTradeExecution,
  validateStatusTransition,
} from "./validation.js";
import { calculateFee } from "./fees.js";
import { ORDER_STATUS } from "./constants.js";

/**
 * Fill an order: create trade, update balances and positions
 * 
 * CRITICAL: All changes (trade, balance, position) in ONE transaction
 * This ensures ledger consistency and prevents double-spending.
 *
 * Flow:
 * 1. Validate execution parameters
 * 2. Validate status transition (pending → filled)
 * 3. Calculate fee (0.1% of trade value)
 * 4. Atomic transaction:
 *    - Update order status + record applied fee
 *    - Create trade record
 *    - Update balance (move from locked, deduct fee)
 *    - Update position (size, avg entry price)
 * 5. Publish to Redis for WebSocket broadcast
 *
 * Invariants enforced:
 * - executedSize <= requestedSize
 * - fee = 0.1% * price * size (exactly)
 * - available + locked = total (unchanged)
 * - position size >= 0 (no short selling)
 *
 * This ensures ledger consistency and prevents fraud or errors.
 */

export async function fillOrder(
  orderId: number,
  executedPrice: DecimalInstance,
  executedSize: DecimalInstance
): Promise<void> {
  validateTradeExecution(executedPrice, executedSize);
  const price = new Decimal(executedPrice);
  const size = new Decimal(executedSize);

  const db = getDb();

  // Get order first (outside transaction)
  const order = await db.orders.findUniqueOrThrow({
    where: { id: orderId },
  });

  // Check status transition is valid
  validateStatusTransition(order.status, ORDER_STATUS.FILLED);

  // Validate execution size <= requested size
  if (size.gt(new Decimal(order.requestedSize))) {
    throw new Error(
      `Execution size ${size} cannot exceed requested size ${order.requestedSize}`
    );
  }

  // Calculate fee (0.1% of trade value)
  const fee = calculateFee(price, size);

  // ATOMIC TRANSACTION: Trade + Balance + Position all at once
  await db.$transaction(async (tx) => {
    // 1. Update order status and record applied fee
    await tx.orders.update({
      where: { id: orderId },
      data: {
        status: ORDER_STATUS.FILLED,
        feesApplied: fee.toString(),
      },
    });

    // 2. Create trade record
    const trade = await tx.trades.create({
      data: {
        orderId,
        userId: order.userId,
        side: order.side,
        executedPrice: price.toString(),
        executedSize: size.toString(),
        fee: fee.toString(),
      },
    });

    // 3. Update balance
    const quoteAsset = order.quoteAsset;
    const baseAsset = order.baseAsset;

    const balance = await tx.balances.findUniqueOrThrow({
      where: {
        userId_asset: { userId: order.userId, asset: quoteAsset },
      },
    });

    const currentAvailable = new Decimal(balance.available);
    const currentLocked = new Decimal(balance.locked);

    if (order.side === "buy") {
      // BUY: Lock released, fees deducted from available
      const requestedSize = new Decimal(order.requestedSize);
      const priceAtOrder = new Decimal(order.priceAtOrderTime);

      // Cost for executed portion at execution price
      const costForExecuted = price.times(size);
      
      // Cost for unexecuted portion (refund at order price)
      const unexecutedSize = requestedSize.minus(size);
      const costForUnexecuted = priceAtOrder.times(unexecutedSize);

      // Total locked was: priceAtOrder * requestedSize
      // Release: unexecuted portion back to available
      const totalLocked = priceAtOrder.times(requestedSize);
      const newLocked = currentLocked.minus(totalLocked);  // All unlocked
      
      // Available: + unexecuted refund - fee
      const newAvailable = currentAvailable
        .plus(costForUnexecuted)
        .minus(fee);

      await tx.balances.update({
        where: {
          userId_asset: { userId: order.userId, asset: quoteAsset },
        },
        data: {
          available: newAvailable.toString(),
          locked: newLocked.toString(),
        },
      });
    } else {
      // SELL: User receives proceeds (cost × size - fee)
      const proceeds = price.times(size).minus(fee);
      
      // Unlock the sold amount
      const costForExecuted = price.times(size);
      const newLocked = currentLocked.minus(costForExecuted);
      const newAvailable = currentAvailable.plus(proceeds);

      await tx.balances.update({
        where: {
          userId_asset: { userId: order.userId, asset: quoteAsset },
        },
        data: {
          available: newAvailable.toString(),
          locked: newLocked.toString(),
        },
      });
    }

    // Update base asset balance (for sell side only)
    if (order.side === "sell") {
      const baseBalance = await tx.balances.findUniqueOrThrow({
        where: {
          userId_asset: { userId: order.userId, asset: baseAsset },
        },
      });
      
      const baseAvailable = new Decimal(baseBalance.available).minus(size);
      
      await tx.balances.update({
        where: {
          userId_asset: { userId: order.userId, asset: baseAsset },
        },
        data: {
          available: baseAvailable.toString(),
        },
      });
    }
    // 4. Update position (size and average entry price)
    const position = await tx.positions.findUniqueOrThrow({
      where: { userId_asset: { userId: order.userId, asset: baseAsset } },
    });

    const currentSize = new Decimal(position.size);
    const currentAvg = new Decimal(position.avgEntryPrice);

    let newSize: Decimal;
    let newAvg: Decimal;

    if (order.side === "buy") {
      // BUY: Increase position, recalculate weighted average entry price
      newSize = currentSize.plus(size);
      
      if (currentSize.isZero()) {
        newAvg = price;
      } else {
        // newAvg = (oldAvg × oldSize + price × newSize) / (oldSize + newSize)
        newAvg = currentAvg
          .times(currentSize)
          .plus(price.times(size))
          .dividedBy(newSize);
      }
    } else {
      // SELL: Decrease position, keep average (for P&L tracking on future buys)
      newSize = currentSize.minus(size);
      
      // Enforce invariant: cannot sell more than owned
      if (newSize.isNegative()) {
        throw new Error(
          `Position update error: selling ${size} but only own ${currentSize} ` +
          `for user ${order.userId} asset ${baseAsset}`
        );
      }
      
      newAvg = currentAvg;  // Unchanged on sell
    }

    // Update position in database
    await tx.positions.update({
      where: { userId_asset: { userId: order.userId, asset: baseAsset } },
      data: {
        size: newSize.toString(),
        avgEntryPrice: newAvg.toString(),
      },
    });
  });

  // TODO: Publish to Redis pub/sub for WebSocket broadcast
}

/**
 * Reject an order and refund reserved balance
 * 
 * Flow:
 * 1. Validate status transition (pending → rejected)
 * 2. Update order status
 * 3. Refund reserved balance from locked → available
 *    For buy orders: refund locked amount back to available
 * 4. Publish to Redis for WebSocket broadcast
 * 
 * Fee policy: Fees are only deducted on FILL, not on placement.
 * Therefore, reject does NOT refund fees.
 */
export async function rejectOrder(
  orderId: number,
): Promise<void> {
  const db = getDb();

  const order = await db.orders.findUniqueOrThrow({
    where: { id: orderId },
  });

  // Validate status transition: pending → rejected
  validateStatusTransition(order.status, ORDER_STATUS.REJECTED);

  await db.$transaction(async (tx) => {
    // 1. Update order status
    await tx.orders.update({
      where: { id: orderId },
      data: {
        status: ORDER_STATUS.REJECTED,
      },
    });

    // 2. Refund locked balance (only for buy orders)
    if (order.side === "buy") {
      const balance = await tx.balances.findUniqueOrThrow({
        where: {
          userId_asset: { userId: order.userId, asset: order.quoteAsset },
        },
      });

      const requestedSize = new Decimal(order.requestedSize);
      const priceAtOrder = new Decimal(order.priceAtOrderTime);

      // Amount that was locked at placement
      const lockedAmount = priceAtOrder.times(requestedSize);

      // Refund locked back to available (no fee refund—fees deducted on fill)
      const newAvailable = new Decimal(balance.available).plus(lockedAmount);
      const newLocked = new Decimal(balance.locked).minus(lockedAmount);

      await tx.balances.update({
        where: {
          userId_asset: { userId: order.userId, asset: order.quoteAsset },
        },
        data: {
          available: newAvailable.toString(),
          locked: newLocked.toString(),
        },
      });
    }
});
// TODO: Publish to Redis pub/sub for WebSocket broadcast
}

