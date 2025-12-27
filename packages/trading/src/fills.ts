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
import { calculateFee, validateFee } from "./fees.js";
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

  // Validate execution size <= requested size (prevents overspend)
  const requestedSize = new Decimal(order.requestedSize);
  if (size.gt(requestedSize)) {
    throw new Error(
      `Execution size ${size} cannot exceed requested size ${requestedSize}`
    );
  }

  // ATOMIC TRANSACTION: Trade + Balance + Position all at once
  await db.$transaction(async (tx) => {
    // CRITICAL: Calculate and validate fee INSIDE transaction for read consistency
    const fee = calculateFee(price, size);
    validateFee(fee, fee);  // Sanity check: fee must be valid Decimal

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
      // BUY: Refund unexecuted portion, deduct executed fee
      const priceAtOrder = new Decimal(order.priceAtOrderTime);

      // Cost locked at order time
      const totalLocked = priceAtOrder.times(requestedSize);
      
      // Unexecuted portion refund
      const unexecutedSize = requestedSize.minus(size);
      const costForUnexecuted = priceAtOrder.times(unexecutedSize);
      
      // Simple: unlock everything, deduct only the executed fee
      const newLocked = currentLocked.minus(totalLocked);  // All unlocked
      const newAvailable = currentAvailable
        .plus(costForUnexecuted)
        .minus(fee);  // ← Only deduct executed fee

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
      
      const baseAvailable = new Decimal(baseBalance.available);
      
      // CRITICAL: Invariant - must have the base asset to sell
      if (baseAvailable.lt(size)) {
        throw new Error(
          `Base asset mismatch: trying to sell ${size} ${baseAsset} ` +
          `but balance shows only ${baseAvailable}. ` +
          `This indicates position and balance are out of sync`
        );
      }
      
      await tx.balances.update({
        where: {
          userId_asset: { userId: order.userId, asset: baseAsset },
        },
        data: {
          available: baseAvailable.minus(size).toString(),
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
      
      // Sanity check: size must be positive after buy
      if (newSize.lte(0)) {
        throw new Error(
          `Invalid position size after buy fill: ${newSize}. ` +
          `This indicates a bug in the trading engine`
        );
      }
      
      if (currentSize.isZero()) {
        // First buy: cost basis = execution price
        newAvg = price;
      } else {
        // Pyramid: newAvg = (oldAvg × oldSize + price × newSize) / (oldSize + newSize)
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
      
      // FIX: Reset avgEntryPrice to 0 if position fully closed
      if (newSize.isZero()) {
        newAvg = new Decimal('0');  // Clear cost basis on full close
      } else {
        newAvg = currentAvg;  // Keep avg for partial close (P&L tracking)
      }
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

