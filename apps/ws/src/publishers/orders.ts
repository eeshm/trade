/**
 * Order Publisher
 *
 * Subscribes to Redis order events and broadcasts to specific users.
 */

import { client, client as redis } from "@repo/redis";
import type { OrderFilledEvent, PortfolioUpdateEvent } from "@repo/events";
import { redisKeys } from "@repo/redis";
import type { AuthenticatedWebSocket } from "../types.js";
import { sendMessage } from "../handlers/auth.js";
import type { WebSocketServer } from "ws";

/**
 * Start listening for order and portfolio updates
 */
export async function startOrderPublisher(wss: WebSocketServer): Promise<void> {
  const subscriber = redis.duplicate();
  await subscriber.connect();

  // Subscribe to order filled events
  await subscriber.subscribe(redisKeys.CHANNELS.orderFilled(), (message) => {
    try {
      const event: OrderFilledEvent = JSON.parse(message);
      broadcastOrderFilled(wss, event);
    } catch (error) {
      console.error("[WS] Failed to parse order filled event:", error);
    }
  });

  // Subscribe to portfolio updates
  await subscriber.subscribe(
    redisKeys.CHANNELS.portfolioUpdate(),
    (message) => {
      try {
        const event = JSON.parse(message) as PortfolioUpdateEvent;
        broadcastPortfolioUpdate(wss, event);
      } catch (error) {
        console.error("[WS] Failed to parse portfolio update event:", error);
      }
    }
  );
  
}
function broadcastOrderFilled(
  wss: WebSocketServer,
  event: OrderFilledEvent
): void {
  wss.clients.forEach((client) => {
    const ws = client as AuthenticatedWebSocket;
    
    if (ws.readyState === ws.OPEN && 
        ws.userId === event.userId && 
        ws.subscriptions?.has("orders")) {
      sendMessage(ws, {
        type: "order_filled",
        orderId: event.orderId,
        executedPrice: event.executedPrice,
        executedSize: event.executedSize,
        fee: event.fee,
      });
    }
  });
}

function broadcastPortfolioUpdate(
  wss: WebSocketServer,
  event: PortfolioUpdateEvent
): void {
  wss.clients.forEach((client) => {
    const ws = client as AuthenticatedWebSocket;
    
    if (ws.readyState === ws.OPEN && 
        ws.userId === event.userId && 
        ws.subscriptions?.has("portfolio")) {
      sendMessage(ws, {
        type: "portfolio",
        balances: event.balances,
        positions: event.positions,
      });
    }
  });
}
