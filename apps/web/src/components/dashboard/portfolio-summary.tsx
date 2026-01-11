import { Balance, Position } from '@/types';
import { formatCurrency, formatNumber } from '@/lib/utils';
import { TrendingUp, TrendingDown } from 'lucide-react';
import { useTradingStore } from '@/store/trading';
import { DashboardWrapper } from '@/components/dashboard-wrapper';
import { Card, CardContent } from '@/components/ui/card';

import { cn } from '@/lib/utils';

interface PortfolioSummaryProps {
  balances: Balance[];
  positions: Position[];
  className?: string;
}

export function PortfolioSummary({
  balances,
  positions,
  className,
}: PortfolioSummaryProps) {
  const { prices } = useTradingStore();

  const usdcBalance = balances.find((b) => b.asset === 'USDC');
  const solBalance = balances.find((b) => b.asset === 'SOL');
  const solPosition = positions.find((p) => p.asset === 'SOL');

  // Calculate portfolio value (USDC balance + SOL position value)
  const solPrice = parseFloat(prices.SOL?.price || '150');
  const solValue = solPosition
    ? parseFloat(solPosition.size) * solPrice
    : 0;
  const totalValue =
    (usdcBalance ? parseFloat(usdcBalance.available) : 0) + solValue;

  // Calculate unrealized P&L
  const entryValue = solPosition
    ? parseFloat(solPosition.size) *
    parseFloat(solPosition.avgEntryPrice)
    : 0;
  const unrealizedPnL = solValue - entryValue;
  const unrealizedPnLPercent =
    entryValue > 0 ? (unrealizedPnL / entryValue) * 100 : 0;

  return (
    <DashboardWrapper name="Portfolio Overview" className={className}>
      <Card className="h-full border-0 shadow-none overflow-hidden">
        <CardContent className="p-4 h-full min-h-0">
          <div className="grid grid-cols-2 gap-4 h-full overflow-y-auto">
            {/* Total Portfolio Value */}
            <div className="space-y-1">
              <p className="text-xs font-medium text-muted-foreground">Total Value</p>
              <div className="text-xl font-semibold tracking-tight text-foreground">{formatCurrency(totalValue)}</div>
              <p className="text-[10px] text-muted-foreground">Init: $1M</p>
            </div>

            {/* Unrealized P&L */}
            <div className="space-y-1">
              <p className="text-xs font-medium text-muted-foreground">Unrealized P&L</p>
              <div className="flex items-center gap-2">
                <div className={`text-xl font-semibold tracking-tight ${unrealizedPnL >= 0 ? 'text-green-500' : 'text-red-500'}`}>
                  {unrealizedPnL >= 0 ? '+' : ''}{formatCurrency(unrealizedPnL)}
                </div>
                {unrealizedPnL >= 0 ? (
                  <TrendingUp className="w-4 h-4 text-green-500" />
                ) : (
                  <TrendingDown className="w-4 h-4 text-red-500" />
                )}
              </div>
              <p className={`text-[10px] ${unrealizedPnLPercent >= 0 ? 'text-green-500' : 'text-red-500'}`}>
                {unrealizedPnLPercent >= 0 ? '+' : ''}{unrealizedPnLPercent.toFixed(2)}%
              </p>
            </div>

            {/* USDC Balance */}
            <div className="space-y-1">
              <p className="text-xs font-medium text-muted-foreground">USDC Balance</p>
              <div className="text-lg font-medium tracking-tight text-foreground">{formatCurrency(usdcBalance?.available || '0')}</div>
              {usdcBalance?.locked && parseFloat(usdcBalance.locked) > 0 && (
                <p className="text-[10px] text-muted-foreground">Locked: {formatCurrency(usdcBalance.locked)}</p>
              )}
            </div>

            {/* SOL Position */}
            <div className="space-y-1">
              <p className="text-xs font-medium text-muted-foreground">SOL Holding</p>
              <div className="text-lg font-medium tracking-tight text-foreground">{formatNumber(solBalance?.available || '0', 4)} SOL</div>
              {solPosition && parseFloat(solPosition.size) > 0 && (
                <p className="text-[10px] text-muted-foreground">Avg: ${formatNumber(solPosition.avgEntryPrice, 2)}</p>
              )}
            </div>
          </div>
        </CardContent>
      </Card>
    </DashboardWrapper>
  );
}
