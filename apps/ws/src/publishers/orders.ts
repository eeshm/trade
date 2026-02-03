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
    console.log(`[WS OrderPublisher] Received message on orderFilled channel:`, message);
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
      console.log(`[WS OrderPublisher] Received message on portfolioUpdate channel:`, message);
      try {
        const event = JSON.parse(message) as PortfolioUpdateEvent;
        broadcastPortfolioUpdate(wss, event);
      } catch (error) {
        console.error("[WS] Failed to parse portfolio update event:", error);
      }
    }
  );
  
  console.log("[WS] Order publisher started");
}
function broadcastOrderFilled(
  wss: WebSocketServer,
  event: OrderFilledEvent
): void {
  console.log(`[WS Broadcast] Order filled event received for userId: ${event.userId} (type: ${typeof event.userId})`);
  console.log(`[WS Broadcast] Total connected clients: ${wss.clients.size}`);
  
  wss.clients.forEach((client) => {
    const ws = client as AuthenticatedWebSocket;
    console.log(`[WS Broadcast] Checking client - userId: ${ws.userId} (type: ${typeof ws.userId}), subscriptions: ${Array.from(ws.subscriptions || []).join(',')}, readyState: ${ws.readyState}`);
    
    const isOpen = ws.readyState === ws.OPEN;
    const userMatch = ws.userId === event.userId;
    const hasSubscription = ws.subscriptions?.has("orders");
    
    console.log(`[WS Broadcast] isOpen: ${isOpen}, userMatch: ${userMatch}, hasSubscription: ${hasSubscription}`);
    
    if (isOpen && userMatch && hasSubscription) {
      console.log(`[WS Broadcast] Sending order_filled to user ${ws.userId}`);
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
  console.log(`[WS Broadcast] Portfolio update event received for userId: ${event.userId} (type: ${typeof event.userId})`);
  console.log(`[WS Broadcast] Total connected clients: ${wss.clients.size}`);
  
  wss.clients.forEach((client) => {
    const ws = client as AuthenticatedWebSocket;
    console.log(`[WS Broadcast] Checking client - userId: ${ws.userId} (type: ${typeof ws.userId}), subscriptions: ${Array.from(ws.subscriptions || []).join(',')}, readyState: ${ws.readyState}`);
    
    const isOpen = ws.readyState === ws.OPEN;
    const userMatch = ws.userId === event.userId;
    const hasSubscription = ws.subscriptions?.has("portfolio");
    
    console.log(`[WS Broadcast] isOpen: ${isOpen}, userMatch: ${userMatch}, hasSubscription: ${hasSubscription}`);
    
    if (isOpen && userMatch && hasSubscription) {
      console.log(`[WS Broadcast] Sending portfolio update to user ${ws.userId}`);
      sendMessage(ws, {
        type: "portfolio",
        balances: event.balances,
        positions: event.positions,
      });
    }
  });
}
