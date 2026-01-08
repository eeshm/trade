import { WebSocketServer } from "ws";
import { initRedis, client as redisClient } from "@repo/redis";
import { createWebSocketServer, startPublishers } from "../../../apps/ws/src/server.ts";

let wss: WebSocketServer;
let initialized = false;

const WS_TEST_PORT = 3099; // Use different port for tests

export const getWsTestPort = () => WS_TEST_PORT;

export const startWsServer = async (): Promise<WebSocketServer> => {
  if (initialized) {
    return wss;
  }

  // Redis should already be initialized by API test server
  // But ensure it's connected
  if (!redisClient.isOpen) {
    await initRedis();
  }

  wss = createWebSocketServer(WS_TEST_PORT) as WebSocketServer;
  await startPublishers(wss);
  initialized = true;

  console.log(`[Test] WebSocket server started on port ${WS_TEST_PORT}`);
  return wss;
};

export const stopWsServer = async (): Promise<void> => {
  if (!wss) {
    return;
  }

  return new Promise((resolve) => {
    wss.close(() => {
      initialized = false;
      console.log("[Test] WebSocket server stopped");
      resolve();
    });
  });
};
