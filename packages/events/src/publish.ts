/**
 * Event Publishing
 * 
 * Publish events to Redis pub/sub channels.
 * Used by API and workers to broadcast real-time updates.
 */

import { client as redis, redisKeys } from "@repo/redis";
import type {
  PriceUpdateEvent,
  OrderFilledEvent,
  OrderRejectedEvent,
  PortfolioUpdateEvent,
} from "./types.js";

/**
 * Publish an event to a Redis channel
 */
export async function publish<T>(channel: string, payload: T): Promise<void> {
  const message = JSON.stringify(payload);
  await redis.publish(channel, message);
}

/**
 * Publish price update event
 * Called by price-ingestion worker after updating Redis cache
 */
export async function publishPriceUpdate(symbol:string, price: string): Promise<void> {
  const event : PriceUpdateEvent={
    symbol,
    price,
    timestamp: new Date().toISOString(),
  };
  await publish(redisKeys.CHANNELS.priceUpdate(), event);
}

/**
 * Publish order filled event
 * Called by API after successful order execution
 */
export async function publishOrderFilled(data: Omit<OrderFilledEvent, "timestamp">): Promise<void> {
  const event: OrderFilledEvent = {
    ...data,
    timestamp: new Date().toISOString(),
  };
  await publish(redisKeys.CHANNELS.orderFilled(), event);
}
/**
 * Publish order rejected event
 * Called by API when order is rejected
 */
export async function publishOrderRejected(data: Omit<OrderRejectedEvent, "timestamp">): Promise<void> {
  const event: OrderRejectedEvent = {
    ...data,
    timestamp: new Date().toISOString(),
  };
  await publish(redisKeys.CHANNELS.orderRejected(), event);
}

/**
 * Publish portfolio update event
 * Called by API after balance/position changes
 */
export async function publishPortfolioUpdate(
  data: Omit<PortfolioUpdateEvent, "timestamp">
): Promise<void> {
  const event: PortfolioUpdateEvent = {
    ...data,
    timestamp: new Date().toISOString(),
  };
  await publish(redisKeys.CHANNELS.portfolioUpdate(), event);
}