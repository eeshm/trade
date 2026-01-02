import { Router } from "express";
import { getPriceHandler, getAllPricesHandler, getMarketStatusHandler } from "../controllers/market.ts";

const router: Router = Router();

/**
 * Market Data Routes
 * 
 * GET /market/price/:symbol - Get price for a specific symbol (e.g., SOL)
 * GET /market/prices        - Get prices for all supported symbols
 * GET /market/status        - Get market data availability status
 */

// GET /market/price/:symbol - Single symbol price
router.get("/price/:symbol", getPriceHandler);

// GET /market/prices - All prices
router.get("/prices", getAllPricesHandler); 

// GET /market/status - Market health status
router.get("/status", getMarketStatusHandler);

export default router;
