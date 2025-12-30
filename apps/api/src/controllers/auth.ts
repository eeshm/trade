import type { Request, Response } from "express";
import {
  verifySignature,
  createOrGetUser,
  createSession,
  validateSession,
  revokeSession,
  generateNonce,
  validateAndConsumeNonce,
} from "@repo/auth";


/**
 * GET /auth/nonce
 * Generate a nonce for wallet signature
 */
export async function getNonce(req: Request, res: Response): Promise<void> {
  try {
    const { walletAddress } = req.body;

    if (!walletAddress || typeof walletAddress !== "string") {
      res.status(400).json({ error: "Invalid wallet address" });
      return;
    }

    const nonce = generateNonce(walletAddress);
    res.status(200).json({
      nonce,
      expiresIn: 600, // 10 minutes
      message: `Sign this nonce: ${nonce}`,
    });
  } catch (error) {
    console.error("getNonce error: ", error);
    res.status(500).json({ error: "Failed to generate nonce" });
  }
}

/**
 * POST /auth/login
 * Verify wallet signature and create session
 */
export async function login(req: Request, res: Response): Promise<void> {
  try {
    const { walletAddress, signature, nonce } = req.body;

    // Validate inputs
    if (!walletAddress || !signature || !nonce) {
      res.status(400).json({ error: "Missing required fields" });
      return;
    }

    // Step 1: Validate nonce (consume it)
    const nonceValid = await validateAndConsumeNonce(walletAddress, nonce);
    if (!nonceValid) {
      res.status(401).json({ error: "Invalid or expired nonce" });
      return;
    }

    // Step 2: Verify signature
    const message = `Sign this nonce: ${nonce}`;
    const signatureValid = await verifySignature(
      message,
      signature,
      walletAddress
    );
    if (!signatureValid) {
      res.status(401).json({ error: "Invalid signature" });
      return;
    }

    // Step 3: Create or get user
    const user = await createOrGetUser(walletAddress);

    // Step 4: Create session
    const token = await createSession(user.id);

    res.json({
      token,
      userId: user.id,
      walletAddress: user.walletAddress,
      expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
    });
  } catch (error) {
    console.error("login error:", error);
    res.status(500).json({ error: "Login failed" });
  }
}

/**
 * POST /auth/logout
 * Revoke session token
 */
export async function logout(req: Request, res: Response): Promise<void> {
  try {
    const { token } = (req as any).body;
    if (!token) {
      res.status(400).json({
        error: "Invalid token or No token provided",
      });
    }

    // Revoke session
    const success = await revokeSession(token);

    if (!success) {
      res.status(500).json({ error: "Failed to logout" });
      return;
    }

    res.json({ success: true });
  } catch (error) {
    console.error("logout error:", error);
    res.status(500).json({ error: "Logout failed" });
  }
}
