import crypto from 'crypto';
import {client as redis, redisKeys } from '@repo/redis';

/**
 * Generate a random nonce for wallet signature
 * Nonce is valid for 10 minutes (one-time use)
 * 
 * @param walletAddress - User's wallet address
 * @returns Nonce string (hex)
 */


export async function generateNonce(walletAddress:string) {
    try{
        const nonce = crypto.randomBytes(32).toString('hex');

        const redisKey = redisKeys.NONCE.walletNonce(walletAddress,nonce);
        await redis.set(redisKey,'used', {
            EX: 10 * 60 // Expires in 10 minutes
        });

        return nonce.toString();
    }catch(error){
        console.error("Failed to generate nonce: ", error);
        throw new Error(`Auth: Could not generate nonce for wallet ${walletAddress}`);
    }
}


/** * Validate a nonce for wallet signature
 * Checks if nonce exists and deletes it (one-time use)
 * @param walletAddress - User's wallet address
 * @param nonce - Nonce string to validate
 * @returns true if valid, false otherwise
*/

export async function validateAndConsumeNonce(
    walletAddress:string,
    nonce:string
):Promise<boolean>{ 
    try{
        const redisKey = redisKeys.NONCE.walletNonce(walletAddress,nonce);
        const exists = await redis.exists(redisKey);
        if(exists){
            // Consume the nonce (delete it)
            await redis.del(redisKey);
            return true;
        }
        return false;
    }catch(error){
        console.error("Failed to validate nonce: ", error);
        throw new Error(`Auth: Could not validate nonce for wallet ${walletAddress}`);  
    }
}
/**
 * Redis Key Definitions for Paper Trading App
 * Organized by domain: Price, WebSocket, Rate Limiting, Trading, Cache, Session, Nonce
 * Pattern: <app>:<domain>:<entity>:<id>
 * 
 * Benefits:
 * - Prevents key collisions
 * - Makes debugging easier
 * - Self-documenting
 * - Centralized key management
 */