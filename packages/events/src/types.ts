/**
 * Event Payload Types
 *
 * These define the shape of data published to Redis channels.
 */

export interface PriceUpdateEvent {
  symbol: string;
  price: string; // Decimal string
  timestamp: number; // Unix timestamp in milliseconds
}

export interface OrderFilledEvent {
  userId: number;
  orderId: number;
  side: string;
  baseAsset: string;
  quoteAsset: string;
  executedPrice: string; // Decimal string
  executedSize: string; // Decimal string
  fees: string; // Decimal string
  timestamp: number; // Unix timestamp in milliseconds
}

export interface OrderRejectedEvent {
  userId: number;
  orderId: number;
  reason: string;
  timestamp: number; // Unix timestamp in milliseconds
}

export interface PortfolioUpdateEvent {
  userId: number;
  balances: {
    asset: string;
    available: string; // Decimal string
    locked: string; // Decimal string
  }[];
  positions: {
    asset: string;
    size: string; // Decimal string
    avgEntryPrice: string; // Decimal string
    unrealizedPnl: string; // Decimal string
  }[];
  timestamp: string;
}

export type EventPayload = 
    | PriceUpdateEvent  
    | OrderFilledEvent
    | OrderRejectedEvent
    | PortfolioUpdateEvent;
    