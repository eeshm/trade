/**
 * Export all validation schemas
 */

// Common
export {
  walletAddressSchema,
  positiveDecimalSchema,
  nonNegativeDecimalSchema,
  positiveIntSchema,
  assetSchema,
  orderSideSchema,
  symbolSchema,
} from "./common.js";

// Auth
export {
  getNonceSchema,
  loginSchema,
  type GetNonceInput,
  type LoginInput,
} from "./auth.js";

// Orders
export {
  placeOrderSchema,
  getOrderParamsSchema,
  listOrdersQuerySchema,
  type PlaceOrderInput,
  type GetOrderParams,
  type ListOrdersQuery,
} from "./orders.js";

// Market
export {
  getPriceParamsSchema,
  type GetPriceParams,
} from "./market.js";