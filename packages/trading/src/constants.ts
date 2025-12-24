/**
 * Trading Constants
 * Centralized values for validation and state management
 */

// Order statuses -> filled, pending, rejected
export const ORDER_STATUS = {
    PENDING: "pending",
    FILLED: "filled",
    REJECTED: "rejected",
} as const;


// Order sides -> buy, sell
export const ORDER_SIDE= {
    BUY: "buy",
    SELL: "sell",
} as const;


// Order types -> market (only market orders for now)
export const ORDER_TYPE = {
    MARKET: "market",
} as const;

// Supported trading assets
export const ASSETS={
    SOL: "SOL",
    USDC: "USDC",

} as const;

// Trading fee rate (e.g., 0.1% fee per trade)
export const FEE_RATE = '0.001'; // 0.1% fee per trade


export const INITIAL_BALANCE = {
    [ASSETS.SOL]: 0, // 0 SOL starting balance
    [ASSETS.USDC]: 1000, // 1000 USDC starting balance
} as const;




// Price update interval (e.g., fetch new prices every 10 seconds)
export const PRICE_UPDATE_INTERVAL_MS = 10 * 1000; // 10 seconds    
// Portfolio refresh interval
export const PORTFOLIO_REFRESH_INTERVAL_MS = 15 * 1000; // 15 seconds
// Maximum API requests per minute per wallet
export const MAX_API_REQUESTS_PER_MINUTE = 60;


