/**
 * WebSocket Message Types
 */

import { types } from "util";
import type { WebSocket } from "ws";

export interface AuthenticatedWebSocket extends WebSocket {
    userId:string;
    walletAddress:string;
    isAlive:boolean;
    subscriptions:Set<string>;
}

// Client → Server messages
export type ClientMessage = 
    | {type : "auth",token : string}
    | {type : "subscribe",channel : "prices" | "orders" | "portfolio"}
    | {type : "unsubscribe",channel : "prices" | "orders" | "portfolio"}
    | {type : "ping"};

// Server → Client messages
export type ServerMessage =
  | { type: "auth"; success: boolean; error?: string }
  | { type: "subscribed"; channel: string }
  | { type: "unsubscribed"; channel: string }
  | { type: "price"; symbol: string; price: string; timestamp: string }
  | { type: "order_filled"; orderId: number; executedPrice: string; executedSize: string; fee: string }
  | { type: "portfolio"; balances: any[]; positions: any[] }
  | { type: "error"; message: string }
  | { type: "pong" };

// Subscription channels
export const SUBSCRIPTION_CHANNELS = {
  PRICES: "prices",
  ORDERS: "orders",
  PORTFOLIO: "portfolio",
} as const;

export type SubscriptionChannel = (typeof SUBSCRIPTION_CHANNELS)[keyof typeof SUBSCRIPTION_CHANNELS];