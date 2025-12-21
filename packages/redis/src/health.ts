import client  from "./client.js";

export  async function isRedisHealthy() : Promise<boolean> {
    try {
        await client.ping();
        return true;
    } catch (err) {
        console.error("Redis health check failed:", err);
        return false;
    }
}