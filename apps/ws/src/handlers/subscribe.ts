/**
 * Subscription Handler
 */

import type { AuthenticatedWebSocket, SubscriptionChannel } from "../types.js";
import { sendMessage, isAuthenticated } from "./auth.js";
import { SUBSCRIPTION_CHANNELS } from "../types.js";

/**
 * Handle subscribe request
 */

export function handleSubscribe(
  ws: AuthenticatedWebSocket,
  channel: SubscriptionChannel
): void {
  // Validate channel
  const validChannels = Object.values(SUBSCRIPTION_CHANNELS);
  if (!validChannels.includes(channel)) {
    sendMessage(ws, {
      type: "error",
      message: `Invalid subscription channel: ${channel}`,
    });
    return;
  }

  // Orders and portfolio require authentication
  if (
    (channel === SUBSCRIPTION_CHANNELS.ORDERS ||
      channel === SUBSCRIPTION_CHANNELS.PORTFOLIO) &&
    !isAuthenticated(ws)
  ) {
    sendMessage(ws, {
      type: "error",
      message: `Authentication required for channel: ${channel}`,
    });
    return;
  }
  ws.subscriptions.add(channel);
  sendMessage(ws, {
    type: "subscribed",
    channel,
  });
  console.log(`[WS] Client subscribed to ${channel}`);
}

/**
 * Handle unsubscribe request
 */
export function handleUnsubscribe(
  ws: AuthenticatedWebSocket,
  channel: SubscriptionChannel
): void {
  // Validate channel
  const validChannels = Object.values(SUBSCRIPTION_CHANNELS);
  if (!validChannels.includes(channel)) {
    sendMessage(ws, {
      type: "error",
      message: `Invalid unsubscription channel: ${channel}`,
    });
    return;
  }
  if (ws.subscriptions.has(channel)) {
    ws.subscriptions.delete(channel);
    sendMessage(ws, {
      type: "unsubscribed",
      channel,
    });
    console.log(`[WS] Client unsubscribed from ${channel}`);
  }
}
