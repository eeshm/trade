'use client';

import { Order } from '@/types';
import { formatCurrency, formatDate, formatNumber } from '@/lib/utils';
import { Check, Clock, X } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

interface OrderHistoryProps {
  orders: Order[];
}

const statusConfig = {
  pending: { icon: Clock, color: 'text-yellow-500', bg: 'bg-yellow-500/10' },
  filled: { icon: Check, color: 'text-green-500', bg: 'bg-green-500/10' },
  rejected: { icon: X, color: 'text-red-500', bg: 'bg-red-500/10' },
};

export function OrderHistory({ orders }: OrderHistoryProps) {
  return (
    <Card className="h-full">
      <CardHeader>
        <CardTitle>Order History</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-3 max-h-[calc(100vh-300px)] overflow-y-auto pr-2">
          {orders.length === 0 ? (
            <div className="text-center py-8">
              <p className="text-muted-foreground">No orders yet</p>
            </div>
          ) : (
            orders.map((order) => {
              const statusInfo = statusConfig[order.status];
              const StatusIcon = statusInfo.icon;
              const isBuy = order.side === 'buy';

              return (
                <div
                  key={order.orderId}
                  className="bg-muted rounded p-4 text-sm"
                >
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <div className={`p-2 rounded ${statusInfo.bg}`}>
                        <StatusIcon className={`w-4 h-4 ${statusInfo.color}`} />
                      </div>
                      <div>
                        <p className="font-medium text-foreground">
                          {isBuy ? '🟢' : '🔴'} {order.side.toUpperCase()} SOL
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {formatDate(order.createdAt)}
                        </p>
                      </div>
                    </div>
                    <span
                      className={`text-xs font-medium px-2 py-1 rounded ${statusInfo.bg} ${statusInfo.color}`}
                    >
                      {order.status}
                    </span>
                  </div>

                  <div className="space-y-1 text-xs text-muted-foreground">
                    <div className="flex justify-between">
                      <span>Size:</span>
                      <span>{formatNumber(order.requestedSize, 4)} SOL</span>
                    </div>
                    {order.status === 'filled' && (
                      <>
                        <div className="flex justify-between">
                          <span>Price:</span>
                          <span>${formatNumber(order.executedPrice, 2)}</span>
                        </div>
                        <div className="flex justify-between">
                          <span>Fee:</span>
                          <span>-${formatNumber(order.feesApplied, 2)}</span>
                        </div>
                      </>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>
      </CardContent>
    </Card>
  );
}
