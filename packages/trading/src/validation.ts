/**
 * Trading Validation
 * Input validation and invariant checks before database writes
 */

import Decimal from "decimal.js";
import type { Decimal as DecimalIntsance } from "decimal.js";
import { ORDER_SIDE, ORDER_STATUS, ORDER_TYPE } from "./constants.js";
/**
 * Validate order placement parameters
 * @throws Error if any input is invalid
 */

export function validateOrderInput(
  side: string,
  type: string,
  baseAsset: string,
  quoteAsset: string,
  requestedSize: DecimalIntsance
): void {
  if (!Object.values(ORDER_SIDE).includes(side as any)) {
    throw new Error(`Invalid order side: ${side}`);
  }
  if (!Object.values(ORDER_TYPE).includes(type as any)) {
    throw new Error(`Invalid order type: ${type}`);
  }

  if (!requestedSize || requestedSize.lte(0)) {
    throw new Error(`Invalid requested size: ${requestedSize}`);
  }
  if (!baseAsset || baseAsset.trim().length === 0) {
    throw new Error(`Invalid base asset: ${baseAsset}`);
  }
  if (!quoteAsset || quoteAsset.trim().length === 0) {
    throw new Error(`Invalid quote asset: ${quoteAsset}`);
  }
  if (baseAsset === quoteAsset) {
    throw new Error(`Base and quote assets cannot be the same: ${baseAsset}`);
  }
}

/**
 * Validate order status state machine
 * Only allowed: pending → {filled, rejected}
 * @throws Error if transition is invalid
 */

export function validateStatusTransition(
  currentStatus: string,
  newStatus: string
): void {
  // From pending, can go to filled or rejected
  if (currentStatus === ORDER_STATUS.PENDING) {
    if (
      ![ORDER_STATUS.FILLED, ORDER_STATUS.REJECTED].includes(newStatus as any)
    ) {
      throw new Error(
        `Invalid transitions: '${currentStatus}' -> '${newStatus}'.` +
          `From pending, can only go to filled or rejected`
      );
    }
    return;
  }

  // From filled/rejected (terminal states), cannot transition
  if (
    [ORDER_STATUS.FILLED, ORDER_STATUS.REJECTED].includes(currentStatus as any)
  ) {
    throw new Error(
      `Cannot transition from terminal state '${currentStatus}'. ` +
        `Orders cannot change after filled or rejected`
    );
  }

  throw new Error(`Invalid status: '${currentStatus}'`);
}

/**
 * Validate trade execution parameters
 * @throws Error if price or size is invalid
 */

export function validateTradeExecution(
  executedPrice: DecimalIntsance,
  executedSize: DecimalIntsance
): void {
  if (!executedPrice || !executedPrice.lte(0)) {
    throw new Error(`Invalid executedPrice: '${executedPrice}'. Must be > 0`);
  }
  if (!executedSize || executedSize.lte(0)) {
    throw new Error(`Invalid executedSize: '${executedSize}'. Must be > 0.`);
  }
}

/**
 * Validate balance invariants
 * @throws Error if balances violate constraints
 */

export function validateBalance(
  available: DecimalIntsance,
  locked: DecimalIntsance
): void {
  if (available.lt(0)) {
    throw new Error(
      `Invariant violated: available balance is negative (${available}). ` +
        `This indicates a bug in order execution`
    );
  }
  if (locked.lt(0)) {
    throw new Error(
      `Invariant violated: locked balance is negative (${locked}). ` +
        `This indicates a bug in order execution`
    );
  }
}
