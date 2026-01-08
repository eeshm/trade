/**
 * Rate Limiting Middleware
 *
 * Uses Redis sliding window counter to limit requests.
 * Different limits for different endpoint types.
 */

import { Request, Response, NextFunction } from "express";
import { client as redis ,redisKeys} from "@repo/redis";

interface RateLimitConfig {
  windowMs: number; // Time window in milliseconds
  maxRequests: number; // Max requests per window
  keyPrefix: string; // Redix key prefix
  keyGenerator: (req: Request) => string; // Generate unique key per client
  message?: string; // Custom error message
}

export function createRateLimiter(config:RateLimitConfig){

    const {
        windowMs,
        maxRequests,
        keyPrefix,
        keyGenerator,
        message = "Too many requests, please try again later."
    } = config;

    return async(req:Request,res:Response,next: NextFunction) => {
        try{
            const clientKey = keyGenerator(req);
            const redisKey = `${redisKeys.RATELIMIT.apiRequests(keyPrefix)}:${clientKey}`;
            const now = Date.now();
            const windowStart = now - windowMs;

            // Use Redis transaction for atomicity
            const multi = redis.multi();

            // Remove old entries outside the time window
            multi.zRemRangeByScore(redisKey,0,windowStart);

            // Count requests in current window
            multi.zCard(redisKey);

            // Add current request timestamp
            multi.zAdd(redisKey,{score:now, value: `${now}:${Math.random()}`});

            // Set expiration for the key
            multi.expire(redisKey,Math.ceil(windowMs/1000)+1);

            const results = await multi.exec();
            const requestCount = Number(results?.[1] ?? 0);

            res.setHeader("x-RateLimit-Limit", maxRequests);
            res.setHeader("x-RateLimit-Reswmaining", Math.max(0, maxRequests - requestCount - 1));
            res.setHeader("x-RateLimit-Reset", Math.ceil((now+ windowMs)/1000));

            if(requestCount > maxRequests){
                res.status(429).json({
                    success: false,
                    error: message,
                    code: "RATE_LIMIT_EXCEEDED",
                    retryAfter: Math.ceil(windowMs/1000)
                });
                return;
            }
            next();
        }catch(error){
            // On redis error, allow request (faild open) but log
            console.error("[RATE_LIMIT]Rate limiter error:", error);
            next();
        }
    }
}

/**
 * Extract IP address from request
 */
function getClientIp(req:Request):string{
    const forwarded =  req.headers['x-forwarded-for'];
    if(typeof forwarded === 'string'){
        return forwarded.split(",")[0]?.trim()!;
    }
    return req.socket.remoteAddress || "unknown";
}

/**
 * Extract user ID from authenticated request
 */
function getUserId(req:Request):string{ 
    return (req as any).userId.toString();
}

/**
 * Extract wallet address from request body or auth
 */
function getWalletAddress(req:Request){
    return req.body?.walletAddress || (req as any).walletAddress || "unknown";
}

// ============================================
// Pre-configured Rate Limiters
// ============================================

/**
 * Auth endpoints: 10 requests per minute per IP
 * Protects against brute force attacks
 */
export const authRateLimiter = createRateLimiter({
  windowMs: 60 * 1000,  // 1 minute
  maxRequests: 10,
  keyPrefix: "auth",
  keyGenerator: getClientIp,
  message: "Too many authentication attempts, please try again in a minute",
});

/**
 * Order endpoints: 30 requests per minute per user
 * Prevents order spam
 */
export const orderRateLimiter = createRateLimiter({
  windowMs: 60 * 1000,  // 1 minute
  maxRequests: 30,
  keyPrefix: "orders",
  keyGenerator: getUserId,
  message: "Too many orders, please slow down",
});

/**
 * Read endpoints: 100 requests per minute per user
 * More lenient for read operations
 */
export const readRateLimiter = createRateLimiter({
  windowMs: 60 * 1000,  // 1 minute
  maxRequests: 100,
  keyPrefix: "read",
  keyGenerator: getUserId,
  message: "Too many requests, please try again later",
});

/**
 * Public endpoints: 60 requests per minute per IP
 * Market data, health checks
 */
export const publicRateLimiter = createRateLimiter({
  windowMs: 60 * 1000,  // 1 minute
  maxRequests: 60,
  keyPrefix: "public",
  keyGenerator: getClientIp,
  message: "Too many requests, please try again later",
});

/**
 * Strict limiter for sensitive operations: 5 per minute
 * Password reset, wallet linking, etc.
 */
export const strictRateLimiter = createRateLimiter({
  windowMs: 60 * 1000,  // 1 minute
  maxRequests: 5,
  keyPrefix: "strict",
  keyGenerator: getClientIp,
  message: "Rate limit exceeded for sensitive operation",
});




