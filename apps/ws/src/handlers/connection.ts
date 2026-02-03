/**
 * Connection Handler
 */

import type { AuthenticatedWebSocket, ClientMessage } from "../types.js";
import { handleAuth, sendMessage } from "./auth.js";
import { handleSubscribe, handleUnsubscribe } from "./subscribe.js";

/**
 * Handle new WebSocket connection
 */

export function handleConnection(ws: AuthenticatedWebSocket): void {
  // Initialize socket state
  ws.isAlive = true;
  ws.subscriptions = new Set();

  // Handle incoming messages
  ws.on("message", async (data) => {
    try {
      const dataStr = data.toString();
      const message: ClientMessage = JSON.parse(dataStr);
      await handleMessage(ws, message);
    } catch (error) {
      console.error("[WS] Error processing message:", error);
      sendMessage(ws, { type: "error", message: "Invalid message format" });
    }
  });

  // Handle pong responses for heartbeat
  ws.on("pong", () => {
    ws.isAlive = true;
  });
  ws.on("close", () => {
    // Cleanup logic if validation needed
  });
  ws.on("error", (error) => {
    console.error("[WS] Connection error:", error);
  });
}

/**
 * Route incoming message to appropriate handler
 */
export async function handleMessage(
  ws: AuthenticatedWebSocket,
  message: ClientMessage
): Promise<void> {
  switch (message.type) {
    case "auth":
      await handleAuth(ws, message.token);
      break;
    case "subscribe":
      handleSubscribe(ws, message.channel);
      break;
    case "unsubscribe":
      handleUnsubscribe(ws, message.channel);
      break;
    case "ping":
      sendMessage(ws, { type: "pong" });
      break;
    default:
      sendMessage(ws, { type: "error", message: "Unknown message type" });
  }
}
