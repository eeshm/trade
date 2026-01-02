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
  await redis.publish(channel, JSON.stringify(payload));
}

/**
 * Publish price update event
 */
export async function publishPriceUpdate(event: PriceUpdateEvent): Promise<void> {
  await publish(redisKeys.CHANNELS.priceUpdate(), event);
}

/**
 * Publish order filled event
 */
export async function publishOrderFilled(event: OrderFilledEvent): Promise<void> {
  await publish(redisKeys.CHANNELS.orderFilled(), event);
}

/**
 * Publish order rejected event
 */
export async function publishOrderRejected(event: OrderRejectedEvent): Promise<void> {
  await publish(redisKeys.CHANNELS.orderRejected(), event);
}

/**
 * Publish portfolio update event
 */
export async function publishPortfolioUpdate(event: PortfolioUpdateEvent): Promise<void> {
  await publish(redisKeys.CHANNELS.portfolioUpdate(), event);
}
