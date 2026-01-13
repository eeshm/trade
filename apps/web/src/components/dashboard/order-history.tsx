'use client';

import { Order } from '@/types';
import { formatDate, formatNumber } from '@/lib/utils';
import { DashboardWrapper } from '@/components/dashboard-wrapper';
import { Card, CardContent } from '@/components/ui/card';
import { cn } from '@/lib/utils';

interface OrderHistoryProps {
  orders: Order[];
}

function Description({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <p className={cn("text-xs font-medium text-muted-foreground", className)}>{children}</p>
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

export function OrderHistory({ orders }: OrderHistoryProps) {
  return (
    <DashboardWrapper name="Order History" className="h-full">
      <Card className="h-full border-0 shadow-none overflow-hidden flex flex-col">
        <CardContent className="p-4 flex-1 min-h-0 flex flex-col">
          <div className="space-y-3 flex-1 overflow-y-auto pr-2">
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
