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
    console.log("[WS Auth] Validating token...");
    const session = await validateSession(token);

    if (!session.valid || !session.userId) {
      console.log("[WS Auth] Session invalid");
      sendMessage(ws, {
        type: "auth",
        success: false,
        error: "Invalid or expired session",
      });
      return;
    }

    // Attach user info to socket
    ws.userId = session.userId;

    //TODO: attach wallet address
    // ws.walletAddress = session.walletAddress!;

    console.log(`[WS Auth] User ${session.userId} authenticated successfully`);
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
  console.log("[WS] Attempting to send message:", JSON.stringify(message), "ws.readyState:", ws.readyState, "OPEN:", ws.OPEN);
  if (ws.readyState === ws.OPEN) {
    console.log("[WS] Socket is OPEN, sending message");
    ws.send(JSON.stringify(message));
  } else {
    console.log("[WS] Socket not OPEN, cannot send message. readyState:", ws.readyState);
  }
}