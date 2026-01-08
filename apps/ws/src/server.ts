5; /**
 * WebSocket Server Setup
 *
 * Creates the server and configures heartbeat for dead connection detection.
 */

import { WebSocketServer } from "ws";
import type { AuthenticatedWebSocket } from "./types.js";
import { handleConnection } from "./handlers/index.js";
import {
  startPricePublisher,
  startOrderPublisher,
} from "./publishers/index.js";

const HEARTBEAT_INTERVAL = 30000; // 30 seconds

/**
 * Create and configure WebSocket server
 *
 * TODO:
 * 1. Create WebSocketServer on specified port
 * 2. Set up "connection" event handler -> call handleConnection
 * 3. Set up heartbeat interval:
 *    - Iterate wss.clients
 *    - If !ws.isAlive: terminate connection
 *    - Else: set isAlive = false, call ws.ping()
 * 4. Set up "close" event to clearInterval on server shutdown
 * 5. Return wss
 *
 * @param port Port to listen on
 * @returns WebSocketServer instance
 */


/**
 * Create and configure WebSocket server
 */
export function createWebSocketServer(port: number): WebSocketServer {
  const wss = new WebSocketServer({ port });

  wss.on("connection", (ws) => {
    handleConnection(ws as AuthenticatedWebSocket);
  });

  // Start heartbeat to detect dead connections
  const heartbeat = setInterval(() => {
    wss.clients.forEach((client) => {
      const ws = client as AuthenticatedWebSocket;
      if (!ws.isAlive) {
        console.log("[WS] Terminating dead connection");
        return ws.terminate();
      }
      ws.isAlive = false;
      ws.ping();
    });
  }, HEARTBEAT_INTERVAL);

  wss.on("close", () => {
    clearInterval(heartbeat);
  });

  return wss;
}

/**
 * Start all Redis subscribers (publishers)
 */
export async function startPublishers(wss: WebSocketServer): Promise<void> {
  await Promise.all([startOrderPublisher(wss), startPricePublisher(wss)]);
}
