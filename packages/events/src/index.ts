/**
 * Events Package
 * 
 * Real-time event publishing and channel definitions.
 * Used by API/workers to publish, WebSocket server to subscribe.
 */

// Channel names
export { redisKeys } from "@repo/redis";
// Event types
export type {
  PriceUpdateEvent,
  OrderFilledEvent,
  OrderRejectedEvent,
  PortfolioUpdateEvent,
  EventPayload,
} from "./types.js";

// Publishers
export {
  publishPriceUpdate,
  publishOrderFilled,
  publishOrderRejected,
  publishPortfolioUpdate,
} from "./publish.js";