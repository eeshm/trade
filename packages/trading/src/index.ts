/**
 * Trading Module
 * Main barrel export for all trading functionality
 */

// Constants
export { ORDER_STATUS, ORDER_SIDE, ORDER_TYPE, ASSETS, FEE_RATE, INITIAL_BALANCE } from './constants.js';

// Validation
export {
  validateOrderInput,
  validateStatusTransition,
  validateTradeExecution,
  validateBalance,
} from './validation.js';

// Fees
export { calculateFee, validateFee } from './fees.js';

// Positions
export { initPosition, updatePosition } from './positions.js';

// Orders
export { placeOrder, getOrder, getUserOrders } from './orders.js';

// Fills (execution)
export { fillOrder, rejectOrder } from './fills.js';

// Portfolio
export { initPortfolio, getPortfolio } from './portfolio.js';