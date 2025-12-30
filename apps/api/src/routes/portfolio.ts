import { Router } from 'express';
import { authMiddleware } from '../middlewares/auth.ts';
import { getPortfolioHandler } from '../controllers/portfolio.ts';


const router: Router =  Router();

/**
 * GET /portfolio
 * Get user's portfolio (balances, positions, open orders)
 * Protected - requires auth
 */

router.post("/",authMiddleware,getPortfolioHandler);

export default router;