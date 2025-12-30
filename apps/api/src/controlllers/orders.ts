import { Request, Response } from "express";
import { Decimal } from "decimal.js";
import { placeOrder, getOrder, getUserOrders } from "@repo/trading";
import { get } from "http";

/**
 * POST /orders
 * Place a market order (buy or sell)
 *
 * Request body:
 * {
 *   side: 'buy' | 'sell',
 *   baseAsset: 'SOL',
 *   quoteAsset: 'USD',
 *   requestedSize: '10',        // Decimal string
 *   priceAtOrderTime: '230'     // Decimal string
 * }
 *
 * Response:
 * {
 *   success: true,
 *   orderId: 123,
 *   feesApplied: '0.23'
 * }
 */

export async function placeOrderHandler(req: Request, res: Response) {
  try {
    const { side, baseAsset, quoteAsset, requestedSize, priceAtOrderTime } =
      req.body;
    const userId = (req as any).user.id; // Assume user ID is set in req.user by auth middleware

    const size = new Decimal(requestedSize);
    const price = new Decimal(priceAtOrderTime);

    const result = await placeOrder(
      userId,
      side,
      baseAsset,
      quoteAsset,
      size,
      price
    );
    res.status(200).json({
      success: true,
      orderId: result.orderId,
      feesApplied: result.feeApplied.toString(),
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    res.status(400).json({ success: false, error: message });
  }
}

/**
 * GET /orders/:orderId
 * Retrieve a single order by ID
 */
export async function getOrderHandler(
  req: Request,
  res: Response
): Promise<void> {
  try {
    const { orderId } = req.params;
    const order = await getOrder(parseInt(orderId as string, 10));
    if (!order) {
      res.status(404).json({ success: false, error: "Order not found" });
      return;
    }
    res.status(200).json({
      success: true,
      order,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    res.status(400).json({ success: false, error: message });
  }
}

/**
 * GET /orders
 * List all orders for authenticated user
 *
 * Response:
 * {
 *   success: true,
 *   orders: [
 *     { id: 1, side: 'buy', status: 'pending', ... },
 *     { id: 2, side: 'sell', status: 'filled', ... }
 *   ]
 * }
 */

export async function getUserOrdersHandler(
  req: Request,
  res: Response
): Promise<void> {
  try {
    const userId = (req as any).user.id; // Assume user ID is set in req.user by auth middleware
    const orders = await getUserOrders(userId);

    if (!orders) {
      res
        .status(404)
        .json({ success: false, error: "No orders found for user" });
      return;
    }
    res.status(200).json({
      success: true,
      orders,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    res.status(400).json({ success: false, error: message });
  }
}
