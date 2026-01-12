'use client';

import { Order } from '@/types';
import { formatCurrency, formatDate, formatNumber } from '@/lib/utils';
import { DashboardWrapper } from '@/components/dashboard-wrapper';
import { Card, CardContent } from '@/components/ui/card';
import { cn } from '@/lib/utils';

interface OrderHistoryProps {
  orders?: Order[];
}
export const sampleOrders: Order[] = [
  {
    orderId: 1,
    side: "buy",
    status: "filled",
    baseAsset: "SOL",
    quoteAsset: "USDC",
    requestedSize: "5",
    executedPrice: "195.50",
    executedSize: "5",
    feesApplied: "9.78",
    createdAt: "2026-01-10T09:15:30Z",
    updatedAt: "2026-01-10T09:15:45Z",
  },
  {
    orderId: 12,
    side: "sell",
    status: "filled",
    baseAsset: "SOL",
    quoteAsset: "USDC",
    requestedSize: "2",
    executedPrice: "210.00",
    executedSize: "2",
    feesApplied: "4.20",
    createdAt: "2026-01-11T11:20:10Z",
    updatedAt: "2026-01-11T11:20:10Z",
  },
  {
    orderId: 2,
    side: "sell",
    status: "filled",
    baseAsset: "SOL",
    quoteAsset: "USDC",
    requestedSize: "2",
    executedPrice: "210.00",
    executedSize: "2",
    feesApplied: "4.20",
    createdAt: "2026-01-11T11:20:10Z",
    updatedAt: "2026-01-11T11:20:10Z",
  },
  {
    orderId: 3,
    side: "sell",
    status: "filled",
    baseAsset: "SOL",
    quoteAsset: "USDC",
    requestedSize: "2",
    executedPrice: "210.00",
    executedSize: "2",
    feesApplied: "4.20",
    createdAt: "2026-01-11T11:20:10Z",
    updatedAt: "2026-01-11T11:20:10Z",
  },
  {
    orderId: 4,
    side: "sell",
    status: "filled",
    baseAsset: "SOL",
    quoteAsset: "USDC",
    requestedSize: "2",
    executedPrice: "210.00",
    executedSize: "2",
    feesApplied: "4.20",
    createdAt: "2026-01-11T11:20:10Z",
    updatedAt: "2026-01-11T11:20:10Z",
  },
];


function Description({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <p className={cn("text-xs font-medium text-muted-foreground", className)}>{children}</p>
  );
}

function Value({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={cn("text-sm font-medium tracking-tight text-foreground", className)}>{children}</div>
  );
}

interface OrderRowProps {
  order: Order;
  isBuy: boolean;
}

function OrderRow({ order, isBuy }: OrderRowProps) {
  return (
    <div className='space-y-2 flex flex-col border-l border-muted-foreground/20 pl-3'>
      <div className='flex items-start justify-between'>
        <Description>{isBuy ? '🟢 BUY' : '🔴 SELL'} SOL</Description>
        <Description className='text-[10px]'>{formatDate(order.createdAt)}</Description>
      </div>
      
      <div className='text-xs space-y-1 text-muted-foreground pl-0'>
        <div className='flex justify-between'>
          <span>Size:</span>
          <span className='text-foreground'>{formatNumber(order.requestedSize, 4)} SOL</span>
        </div>
        <div className='flex justify-between'>
          <span>Price:</span>
          <span className='text-foreground'>${formatNumber(order.executedPrice, 2)}</span>
        </div>
        <div className='flex justify-between'>
          <span>Fee:</span>
          <span className='text-foreground'>-${formatNumber(order.feesApplied, 2)}</span>
        </div>
      </div>
    </div>
  );
}

export function OrderHistory({ orders = sampleOrders }: OrderHistoryProps) {
  return (
    <DashboardWrapper name="Order History" className="h-full">
      <Card className="h-full border-0 shadow-none overflow-hidden">
        <CardContent className="p-4 h-full min-h-0">
          <div className="space-y-3 h-full overflow-y-auto">
            {orders.length === 0 ? (
              <div className="text-center py-8">
                <p className="text-muted-foreground">No orders yet</p>
              </div>
            ) : (
              orders.map((order) => {
                const isBuy = order.side === 'buy';
                return (
                  <OrderRow key={order.orderId} order={order} isBuy={isBuy} />
                );
              })
            )}
          </div>
        </CardContent>
      </Card>
    </DashboardWrapper>
  );
}
