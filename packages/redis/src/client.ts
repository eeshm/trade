import { createClient } from "redis";
import { RedisClientType } from "redis";

const client : RedisClientType = createClient({
    url: process.env.REDIS_URL
});

client.on('error',err=>console.log('Redis Client Error',err));

export default client;
