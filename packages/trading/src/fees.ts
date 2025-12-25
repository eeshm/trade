/**
 * Fee Calculation
 * Handles fee computation and validation (0.1% per trade)
 */
import type { Decimal as DecimalInstance } from "decimal.js";
import { FEE_RATE } from './constants.js';

/**
 * Calculate trading fee: 0.1% of trade value
 * fee = executedPrice * executedSize * 0.001
 * @returns Fee amount as Decimal
 */


export function calculateFee(
    executedPrice: DecimalInstance,
    executedSize: DecimalInstance
): DecimalInstance {
    // Fee invariant: fee == 0.1% * executedPrice * executedSize (exactly)
    return executedPrice.mul(executedSize).mul(FEE_RATE) as DecimalInstance;
}

/**
 * Validate that provided fee matches calculated fee
 * Prevents accidental or malicious fee mismatches
 * @throws Error if fees don't match
 */

export function validateFee(
    calculatedFee: DecimalInstance,
    providedFee: DecimalInstance
): void {
    if (!calculatedFee.equals(providedFee)) {
        throw new Error(
            `Fee mismatch: calculated ${calculatedFee.toString()}, ` +
            `provided ${providedFee.toString()}`
        );
    }
}