import WebSocket from "ws";

export interface WsMessage {
  type: string;
  [key: string]: any;
}

/**
 * Create a WebSocket client that connects to the test server
 */
export const createWsClient = (port: number): Promise<WebSocket> => {
  return new Promise((resolve, reject) => {
    const ws = new WebSocket(`ws://localhost:${port}`);

    ws.on("open", () => {
      resolve(ws);
    });

    ws.on("error", (error:any) => {
      reject(error);
    });

    // Timeout after 5 seconds
    setTimeout(() => {
      reject(new Error("WebSocket connection timeout"));
    }, 5000);
  });
};

/**
 * Send a message and wait for a specific response type
 */
export const sendAndWaitFor = (
  ws: WebSocket,
  message: WsMessage,
  expectedType: string,
  timeout = 5000
): Promise<WsMessage> => {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      reject(new Error(`Timeout waiting for message type: ${expectedType}`));
    }, timeout);

    const handler = (data: WebSocket.RawData) => {
      try {
        const parsed = JSON.parse(data.toString()) as WsMessage;
        if (parsed.type === expectedType) {
          clearTimeout(timer);
          ws.off("message", handler);
          resolve(parsed);
        }
      } catch {
        // Ignore parse errors, keep waiting
      }
    };

    ws.on("message", handler);
    ws.send(JSON.stringify(message));
  });
};

/**
 * Wait for the next message of a specific type
 */
export const waitForMessage = (
  ws: WebSocket,
  expectedType: string,
  timeout = 5000
): Promise<WsMessage> => {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      reject(new Error(`Timeout waiting for message type: ${expectedType}`));
    }, timeout);

    const handler = (data: WebSocket.RawData) => {
      try {
        const parsed = JSON.parse(data.toString()) as WsMessage;
        if (parsed.type === expectedType) {
          clearTimeout(timer);
          ws.off("message", handler);
          resolve(parsed);
        }
      } catch {
        // Ignore parse errors
      }
    };

    ws.on("message", handler);
  });
};

/**
 * Authenticate WebSocket connection with session token
 */
export const authenticateWs = async (
  ws: WebSocket,
  token: string
): Promise<WsMessage> => {
  return sendAndWaitFor(ws, { type: "auth", token }, "auth");
};

/**
 * Subscribe to a channel
 */
export const subscribeToChannel = async (
  ws: WebSocket,
  channel: "prices" | "orders" | "portfolio"
): Promise<WsMessage> => {
  return sendAndWaitFor(ws, { type: "subscribe", channel }, "subscribed");
};

/**
 * Close WebSocket connection gracefully
 */
export const closeWs = (ws: WebSocket): Promise<void> => {
  return new Promise((resolve) => {
    if (ws.readyState === WebSocket.CLOSED) {
      resolve();
      return;
    }

    ws.on("close", () => {
      resolve();
    });

    ws.close();
  });
};
