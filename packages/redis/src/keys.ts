/**
 * Redis Key Naming Strategy
 * Pattern: <app>:<domain>:<entity>:<id>
 * 
 * Benefits:
 * - Prevents key collisions
 * - Makes debugging easier
 * - Self-documenting
 * - Centralized key management
 */

const APP = "trading";

// Price Domain
const PRICE = {
  solPrice: () => `${APP}:price:SOL`,
  tokenPrice: (tokenSymbol: string) => `${APP}:price:${tokenSymbol}`,
};

// WebSocket Domain
const WEBSOCKET = {
  userSession: (walletAddress: string) =>
    `${APP}:ws:user:${walletAddress}`,
  userConnections: (walletAddress: string) =>
    `${APP}:ws:connections:${walletAddress}`,
};

// Rate Limiting Domain
const RATELIMIT = {
  walletRequests: (walletAddress: string) =>
    `${APP}:ratelimit:${walletAddress}`,
  apiKey: (apiKey: string) => `${APP}:ratelimit:api:${apiKey}`,
};

// Trading Domain
const TRADING = {
  userPortfolio: (walletAddress: string) =>
    `${APP}:trading:portfolio:${walletAddress}`,
  position: (walletAddress: string, positionId: string) =>
    `${APP}:trading:position:${walletAddress}:${positionId}`,
  openPositions: (walletAddress: string) =>
    `${APP}:trading:positions:open:${walletAddress}`,
  closedPositions: (walletAddress: string) =>
    `${APP}:trading:positions:closed:${walletAddress}`,
};

// Cache Domain
const CACHE = {
  userProfile: (walletAddress: string) =>
    `${APP}:cache:profile:${walletAddress}`,
  marketData: (symbol: string) => `${APP}:cache:market:${symbol}`,
};

// Session Domain
const SESSION = {
  userSession: (sessionId: string) => `${APP}:session:${sessionId}`,
  userTokens: (walletAddress: string) =>
    `${APP}:session:tokens:${walletAddress}`,
};

export const redisKeys = {
  PRICE,
  WEBSOCKET,
  RATELIMIT,
  TRADING,
  CACHE,
  SESSION,
};

/**
 * Usage Examples:
 * 
 * // Get SOL price
 * const priceKey = redisKeys.PRICE.solPrice();
 * 
 * // Store user's open positions
 * const positionsKey = redisKeys.TRADING.openPositions("0x123abc...");
 * 
 * // Rate limit a wallet
 * const limitKey = redisKeys.RATELIMIT.walletRequests("0x123abc...");
 * 
 * // Store session
 * const sessionKey = redisKeys.SESSION.userSession("session_abc123");
 */
