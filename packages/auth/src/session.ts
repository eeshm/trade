import crypto from 'crypto';
import { getDb } from '@repo/db';
import { client as redis } from '@repo/redis';

/**
 * Create a new session for a user
 * Stores in both Postgres (durable) and Redis (fast lookup)
 * 
 * @param userId - User ID from database
 * @returns Session token (opaque string to send to client)
 */


/**
 * Validate a session token
 * Checks Redis first (fast), falls back to Postgres if needed
 * 
 * @param token - Session token from client
 * @returns { valid: boolean, userId?: number } 
 */
