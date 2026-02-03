/**
 * WebSocket Authentication Handler
 */

import { validateSession } from "@repo/auth";
import type { AuthenticatedWebSocket, ServerMessage } from "../types.js";

/**
 * Authenticate a WebSocket connection using session token
 */
export async function handleAuth(
  ws: AuthenticatedWebSocket,
  token: string
): Promise<void> {
  try {
    const session = await validateSession(token);

    if (!session.valid || !session.userId) {
      sendMessage(ws, {
        type: "auth",
        success: false,
        error: "Invalid or expired session",
      });
      return;
    }

    // Attach user info to socket
    ws.userId = session.userId;

    sendMessage(ws, { type: "auth", success: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Auth failed";
    console.error("[WS Auth] Error:", message);
    sendMessage(ws, { type: "auth", success: false, error: message });
  }
}

/**
 * Check if socket is authenticated
 */
export function isAuthenticated(ws: AuthenticatedWebSocket): boolean {
  return ws.userId !== undefined;
}

/**
 * Send message to client
 */
export function sendMessage(ws: AuthenticatedWebSocket, message: ServerMessage): void {
  if (ws.readyState === ws.OPEN) {
    ws.send(JSON.stringify(message));
  }
}