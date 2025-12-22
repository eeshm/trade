import { getDb } from '@repo/db';

/**
 * Create a new user or return existing user by wallet address
 * Uses upsert: if wallet exists, return it; if not, create it
 * 
 * @param walletAddress - User's wallet address (e.g., "8bC7J...")
 * @returns User object with id, walletAddress, createdAt, updatedAt
 */


export async function createOrGetUser(walletAddress : string){
    const db = getDb();
    try{
        const user =  await db.users.upsert({
            where:{walletAddress},
            create:{walletAddress},
            update:{} //No fields to update, just return the existing user
        });

        return user;
    }catch(error){
        console.error("Failed to create or get user: ", error);
        throw new Error(`Auth: Could not get/create user for wallet ${walletAddress}`)
    }
}