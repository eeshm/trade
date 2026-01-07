/**
 * Order Validation Schemas
 */

import { string, z } from "zod";
import {
  positiveDecimalSchema,
  assetSchema,
  orderSideSchema,
  positiveIntSchema,
} from "./common.ts";

/**
 * POST /orders body
 */
export const placeOrderSchema = z
  .object({
    side: orderSideSchema,
    baseAsset: assetSchema,
    quoteAsset: assetSchema,
    requestedSize: positiveDecimalSchema
      .refine((val) => parseFloat(val) > 0.001, {
        message: "requestedSize must be greater than 0.001",
      })
      .refine((val) => parseFloat(val) <= 10000, {
        message: "requestedSize must be less than or equal to 10000",
      }),
  })
  .refine((data) => data.baseAsset !== data.quoteAsset, {
    message: "baseAsset and quoteAsset cannot be the same",
  });

/**
 * GET /orders/:orderId params
 */
export const getOrderParamsSchema = z.object({
  orderId: positiveIntSchema,
});

/**
 * GET /orders query (optional filters)
 */
export const listOrdersQuerySchema = z.object({
  status: z.enum(["pending", "filled", "cancelled"]).optional(),
  side: orderSideSchema.optional(),
  limit: z
    .string()
    .regex(/^\d+$/)
    .transform((val) => Math.min(parseInt(val, 10), 100))
    .optional()
    .default(20),
  offset: z
    .string()
    .regex(/^\d+$/)
    .transform((val) => parseInt(val, 10))
    .optional()
    .default(0),
});

export type PlaceOrderInput = z.infer<typeof placeOrderSchema>;
export type GetOrderParams =z.infer<typeof getOrderParamsSchema>;
export type ListOrdersQuery = z.infer<typeof listOrdersQuerySchema>;
