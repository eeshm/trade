import { Router } from "express";
import { getPriceHandler, getMarketStatusHandler } from "../controllers/market.js";

const router :Router = Router();

// GET /market/price/:symbol
router.get("/price/:symbol", getPriceHandler);

// GET /market/status
router.get("/status", getMarketStatusHandler);

export default router;
