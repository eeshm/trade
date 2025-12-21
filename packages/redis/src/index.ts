import client from "./client.js";

export async function initRedis(): Promise<void> {
  await client.connect();
}

export { default as client } from "./client.js";
export { isRedisHealthy } from "./health.js";
export { redisKeys } from "./keys.js";
/*
  Redis Key Management for Trading Application
  - Centralized key definitions for consistency
  - Organized by domain (price, websocket, ratelimit, trading, cache, session)
  - Follows naming convention: <app>:<domain>:<entity>:<id>
*/
