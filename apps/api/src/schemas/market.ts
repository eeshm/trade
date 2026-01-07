/**
 * Market Validation Schemas
 */

import { z } from "zod";
import { symbolSchema } from "./common.js";

/**
 * GET /market/price/:symbol params
 */
export const getPriceParamsSchema = z.object({
  symbol: symbolSchema,
});

export type GetPriceParams = z.infer<typeof getPriceParamsSchema>;
