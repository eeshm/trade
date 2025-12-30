import { Router } from 'express';
import { authMiddleware } from '../middlewares/auth.js';
import { getPortfolioHandler } from '../controlllers/portfolio.ts';
