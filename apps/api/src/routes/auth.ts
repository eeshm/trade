import { Router } from 'express';
import { getNonce, login, logout } from '../controllers/auth.ts';
import { authMiddleware } from '../middlewares/auth.ts';


const router :Router = Router();

/**
 * Public endpoints (no auth required)
 */

router.post("/nonce", getNonce);
router.post("/login", login);


/**
 * Protected endpoints (auth required)
 */
router.post("/logout", authMiddleware, logout);

export default router;
