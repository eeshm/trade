import { Balance, Position } from '@/types';
import { formatCurrency, formatNumber } from '@/lib/utils';
import { TrendingUp, TrendingDown } from 'lucide-react';
import { useTradingStore } from '@/store/trading';
import { DashboardWrapper } from '@/components/dashboard-wrapper';
import { Card, CardContent } from '@/components/ui/card';

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
    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-6">
      {/* Total Portfolio Value */}
      <DashboardWrapper name="Portfolio Value">
        <Card>
          <CardContent>
            <div className="text-2xl font-semibold tracking-tight text-foreground">{formatCurrency(totalValue)}</div>
            <p className="text-xs text-muted-foreground mt-1">Initial: $1,000,000</p>
          </CardContent>
        </Card>
      </DashboardWrapper>

      {/* USDC Balance */}
      <DashboardWrapper name="USDC Available">
        <Card>
          <CardContent>
            <div className="text-2xl font-semibold tracking-tight text-foreground">{formatCurrency(usdcBalance?.available || '0')}</div>
            {usdcBalance?.locked && parseFloat(usdcBalance.locked) > 0 && (
              <p className="text-xs text-muted-foreground mt-1">
                Locked: {formatCurrency(usdcBalance.locked)}
              </p>
            )}
          </CardContent>
        </Card>
      </DashboardWrapper>

      {/* SOL Position */}
      <DashboardWrapper name="SOL Holding">
        <Card>
          <CardContent>
            <div className="text-2xl font-semibold tracking-tight text-foreground">{formatNumber(solBalance?.available || '0', 4)} SOL</div>
            {solPosition && parseFloat(solPosition.size) > 0 && (
              <p className="text-xs text-muted-foreground mt-1">
                Avg Entry: ${formatNumber(solPosition.avgEntryPrice, 2)}
              </p>
            )}
          </CardContent>
        </Card>
      </DashboardWrapper>

      {/* Unrealized P&L */}
      <DashboardWrapper name="Unrealized P&L">
        <Card>
          <CardContent>
            <div className="flex items-center gap-2">
              <div
                className={`text-2xl font-semibold tracking-tight ${unrealizedPnL >= 0 ? 'text-green-500' : 'text-red-500'
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
      </DashboardWrapper>
    </div>
  );
}
