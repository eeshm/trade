import crypto from 'crypto';
import { getDb } from '@repo/db';
import { client as redis, redisKeys } from '@repo/redis';

/**
 * Create a new session for a user
 * Stores in both Postgres (durable) and Redis (fast lookup)
 * 
 * @param userId - User ID from database
 * @returns Session token (opaque string to send to client)
 */
export async function createSession(userId: number): Promise<string> {
  const db = getDb();

  try {
    // Generate a cryptographically secure random token
    const token = crypto.randomBytes(32).toString('hex');

    // Session expires in 24 hours
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);

    // Store in Postgres (audit trail + durable)
    const session = await db.sessions.create({
      data: {
        userId,
        token,
        expiresAt
      }
    });

    // ---------------------------Now logic of redis from here ------------------------------
    // Cache in Redis for fast lookup
    const redisKey = redisKeys.SESSION.userSession(token);
    await redis.set(redisKey, JSON.stringify({ userId: session.userId, sessionId: session.id }), {
      EX: 24 * 60 * 60 // Expire in 24 hours
    });

    return token;
  } catch (error) {
    console.error('Failed to create session:', error);
    throw new Error('Auth: Could not create session');
  }
}

/**
 * Validate a session token
 * Checks Redis first (fast), falls back to Postgres if needed
 * 
 * @param token - Session token from client
 * @returns { valid: boolean, userId?: number, sessionId?: number }
 */

export async function validateSession(token:string): Promise<{
    valid:boolean,
    userId?:number,
    sessionId?:number
}> {
    try{

        // try first redis path
        const redisKey =  redisKeys.SESSION.userSession(token);
        const cached =  await redis.get(redisKey);

        if(cached){
            const {userId,sessionId}= JSON.parse(cached);
            return {valid:true,userId,sessionId}
        }

        //redis missing - check postgres 
        const db = getDb();
        const session = await db.sessions.findUnique({
            where:{token},
            select:{ id:true, userId : true, expiresAt: true, revokedAt: true, token:true}
        })
        // Validate: exists, not expired, not revoked
        if(!session){
            return {valid:false};
        }
        if(session.expiresAt < new Date()){
            return {valid:false};
        }
        if(session.revokedAt !== null ){
            return {valid:false};
        } // user logged out 

        // Repopulate Redis cache (it was evicted)
        await redis.set(redisKey, JSON.stringify({userId:session.userId, sessionId:session.id}),{
            EX: 24 * 60 * 60
        })
        return { valid: true, userId : session.userId, sessionId : session.id}


    }
    catch(error){
        console.log("Session validations failed: ",error)
        return {valid: false};
    }   
}

/**
 * Revoke a session (logout)
 * Sets revokedAt timestamp so session becomes invalid
 * 
 * @param token - Session token to revoke
 * @returns true if revocation succeeded
 */



export async function revokeSession(token:string): Promise<boolean> {
    try{

        const db = getDb();
        // Mark as revoked in database
        await db.sessions.update({
            where:{token},
            data: { revokedAt: new Date()}
        })
        // Remove from Redis cache immediately
        const redisKey =  redisKeys.SESSION.userSession(token);
        await  redis.del(redisKey)

        return true;
    }
    catch(error){
        console.error("Error in revoking the session: ", error)
        return false;
    }
}
