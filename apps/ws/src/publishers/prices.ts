/**
 * Price Publisher
 * 
 * Subscribes to Redis price updates and broadcasts to WebSocket clients.
 */

import {client as redis } from "@repo/redis";
import type {PriceUpdateEvent} from "@repo/events";
import { redisKeys } from "@repo/redis";
import type { AuthenticatedWebSocket } from "../types.js";
import { sendMessage } from "../handlers/auth.js";
import type { WebSocketServer } from "ws";


/**
 * Start listening for price updates and broadcast to clients
 */

export async function startPricePublisher(wss:WebSocketServer): Promise<void> {
    
    // Create a separate Redis client for subscription
    const subscriber =  redis.duplicate();
    await subscriber.connect();

    // Subscribe to price update channel
    await subscriber.subscribe(redisKeys.CHANNELS.priceUpdate(), (message) => {
        try{
            const event: PriceUpdateEvent = JSON.parse(message);
            broadcastPrice(wss,event);   
        }catch(error){
            console.error("[WS] [PricePublisher] Failed to process price update:", error);
        }
    });
}



function broadcastPrice(wss:WebSocketServer,event:PriceUpdateEvent){
    wss.clients.forEach((client)=>{
        const ws = client as AuthenticatedWebSocket;
        if(ws.readyState === ws.OPEN && ws.subscriptions.has("prices")){
            sendMessage(ws,{
                type:"price",
                symbol:event.symbol,
                price:event.price,
                timestamp:event.timestamp
            })
        }
    })
}

