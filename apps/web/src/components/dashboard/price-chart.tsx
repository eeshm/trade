'use client';

import { PriceData } from '@/types';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';
import { useMemo } from 'react';
import { DashboardWrapper } from '@/components/dashboard-wrapper';
import { Card, CardContent } from '@/components/ui/card';

interface PriceChartProps {
  prices: { [symbol: string]: PriceData };
}

export function PriceChart({ prices }: PriceChartProps) {
  const solPrice = prices['SOL']?.price || '0';

  // Generate mock historical data for demo
  // In production, you'd fetch this from the backend
  const chartData = useMemo(() => {
    const basePrice = parseFloat(solPrice) || 150;
    const data = [];
    for (let i = 0; i < 24; i++) {
      const variation = (Math.random() - 0.5) * 20;
      data.push({
        time: `${i}:00`,
        price: parseFloat((basePrice + variation).toFixed(2)),
      });
    }
    return data;
  }, [solPrice]);

  return (
    <DashboardWrapper name="SOL/USD Price Chart">
      <Card>
        <CardContent>
          <div className="flex flex-col mb-4">
            <span className="text-2xl font-semibold tracking-tight text-foreground">
              ${parseFloat(solPrice).toFixed(2)}
            </span>
            <span className="text-sm text-muted-foreground">Real-time price via Pyth</span>
          </div>
          <div className="h-[300px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis
                  dataKey="time"
                  stroke="hsl(var(--muted-foreground))"
                  style={{ fontSize: '12px' }}
                  tickLine={false}
                  axisLine={false}
                />
                <YAxis
                  stroke="hsl(var(--muted-foreground))"
                  style={{ fontSize: '12px' }}
                  tickLine={false}
                  axisLine={false}
                  domain={['auto', 'auto']}
                />
                <Tooltip
                  contentStyle={{
                    backgroundColor: 'hsl(var(--popover))',
                    border: '1px solid hsl(var(--border))',
                    borderRadius: '6px',
                    color: 'hsl(var(--popover-foreground))',
                  }}
                  labelStyle={{ color: 'hsl(var(--muted-foreground))' }}
                  formatter={(value: any) => [`$${value.toFixed(2)}`, 'Price']}
                />
                <Line
                  type="monotone"
                  dataKey="price"
                  stroke="hsl(var(--primary))"
                  dot={false}
                  strokeWidth={2}
                  isAnimationActive={false}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>
    </DashboardWrapper>
  );
}
