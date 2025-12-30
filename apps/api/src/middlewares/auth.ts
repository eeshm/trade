import type { Request, Response, NextFunction } from "express";
import { validateSession } from "@repo/auth";

/**
 * Auth middleware - validates session token
 * Expects: Authorization: Bearer {token}
 * Attaches: req.token, req.userId, req.sessionId
 */

export async function authMiddleware(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      res
        .status(401)
        .json({ error: "Missing or invalid authorization header" });
      return;
    }
    const token = authHeader.slice(7); //Remove "Bearer "

    // Validate session
    const { valid, userId, sessionId } = await validateSession(token);

    if (!valid) {
      res.status(401).json({ error: "Invalid or expired token" });
      return;
    }

    (req as any).token = token;
    (req as any).userId = userId;
    (req as any).sessionId = sessionId;

    next();
  } catch (error) {
    console.error("authMiddleware error:", error);
    res.status(500).json({ error: "Authentication failed" });
  }
}
