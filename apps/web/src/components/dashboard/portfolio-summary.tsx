import { Balance, Position } from '@/types';
import { formatCurrency, formatNumber } from '@/lib/utils';
import { TrendingUp, TrendingDown } from 'lucide-react';
import { useTradingStore } from '@/store/trading';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

interface PortfolioSummaryProps {
  balances: Balance[];
  positions: Position[];
}

export function PortfolioSummary({
  balances,
  positions,
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
    <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
      {/* Total Portfolio Value */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Portfolio Value</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{formatCurrency(totalValue)}</div>
          <p className="text-xs text-muted-foreground mt-1">Initial: $1,000,000</p>
        </CardContent>
      </Card>

      {/* USDC Balance */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">USDC Available</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{formatCurrency(usdcBalance?.available || '0')}</div>
          {usdcBalance?.locked && parseFloat(usdcBalance.locked) > 0 && (
            <p className="text-xs text-muted-foreground mt-1">
              Locked: {formatCurrency(usdcBalance.locked)}
            </p>
          )}
        </CardContent>
      </Card>

      {/* SOL Position */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">SOL Holding</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{formatNumber(solBalance?.available || '0', 4)} SOL</div>
          {solPosition && parseFloat(solPosition.size) > 0 && (
            <p className="text-xs text-muted-foreground mt-1">
              Avg Entry: ${formatNumber(solPosition.avgEntryPrice, 2)}
            </p>
          )}
        </CardContent>
      </Card>

      {/* Unrealized P&L */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Unrealized P&L</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-2">
            <div
              className={`text-2xl font-bold ${unrealizedPnL >= 0 ? 'text-green-500' : 'text-red-500'
                }`}
            >
              {unrealizedPnL >= 0 ? '+' : ''}{formatCurrency(unrealizedPnL)}
            </div>
            {unrealizedPnL >= 0 ? (
              <TrendingUp className="w-4 h-4 text-green-500" />
            ) : (
              <TrendingDown className="w-4 h-4 text-red-500" />
            )}
          </div>
          <p
            className={`text-xs mt-1 ${unrealizedPnLPercent >= 0 ? 'text-green-500' : 'text-red-500'
              }`}
          >
            {unrealizedPnLPercent >= 0 ? '+' : ''}
            {unrealizedPnLPercent.toFixed(2)}%
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
