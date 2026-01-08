/**
 * Auth Validation Schemas
 */

import { z } from "zod";
import { walletAddressSchema } from "./common.js";

/**
 * GET /auth/nonce query params
 */
export const getNonceSchema = z.object({
  walletAddress: walletAddressSchema,
});

/**
 * POST /auth/login body
 */
export const loginSchema = z.object({
  walletAddress: walletAddressSchema,
  signature: z
    .string()
    .min(64, "Signature too short")
    .max(200, "Signature too long"),
  nonce: z
    .string()
    .min(1, "Nonce required")
    .max(200, "Nonce too long"),
});

export type GetNonceInput = z.infer<typeof getNonceSchema>;
export type LoginInput = z.infer<typeof loginSchema>;