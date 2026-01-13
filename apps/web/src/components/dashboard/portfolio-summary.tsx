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

  // Defensive check: ensure balances and positions are arrays
  const safeBalances = Array.isArray(balances) ? balances : [];
  const safePositions = Array.isArray(positions) ? positions : [];

  const usdcBalance = safeBalances.find((b) => b.asset === 'USDC');
  const solBalance = safeBalances.find((b) => b.asset === 'SOL');
  const solPosition = safePositions.find((p) => p.asset === 'SOL');

  // Calculate portfolio value (USDC balance + SOL position value)
  const solPrice = parseFloat(prices.SOL?.price || '0');
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
        <CardContent className="p-2 h-full min-h-0">
          <div className="flex flex-col space-y-4">
            {/* Total Portfolio Value */}
            <Card2>
              <Description>Total Value</Description>
              <div className='ml-auto text-right'>
                <Value>{formatCurrency(totalValue)}</Value>
              </div>
            </Card2>
            {/* Unrealized P&L */}
            <Card2>
              <Description>Unrealized P&L</Description>
              <div className='ml-auto text-right'>
                  {/* {unrealizedPnL >= 0 ? (
                  <TrendingUp className="w-4 h-4 text-green-500" />
                ) : (
                  <TrendingDown className="w-4 h-4 text-red-500" />
                )} */}
                  <Value className={`${unrealizedPnL >= 0 ? 'text-green-500' : 'text-red-500'}`}>
                   <span className='text-[10px]'>({unrealizedPnLPercent >= 0 ? '+' : ''}{unrealizedPnLPercent.toFixed(2)}%)</span> {unrealizedPnL >= 0 ? '+' : ''}{formatCurrency(unrealizedPnL)} 
                  </Value>
              </div>
            </Card2>
            {/* USDC Balance */}
            <Card2>
              <Description>USDC Balance</Description>
              <div className='ml-auto text-right'>
                <Value>{formatCurrency(usdcBalance?.available || '0')}</Value>
                {usdcBalance?.locked && parseFloat(usdcBalance.locked) > 0 && (
                  <p className="text-[10px] text-muted-foreground">Locked: {formatCurrency(usdcBalance.locked)}</p>
                )}
              </div>
            </Card2>

            {/* SOL Position */}
            <Card2>
              <Description>SOL Holding</Description>
              <div className='ml-auto text-right'>
                <Value>{formatNumber(solBalance?.available || '0', 4)} SOL</Value>
                {solPosition && parseFloat(solPosition.size) > 0 && (
                  <p className="text-[10px] text-muted-foreground">Avg: ${formatNumber(solPosition.avgEntryPrice, 2)}</p>
                )}
              </div>
            </Card2>
          </div>
        </CardContent>
      </Card>
    </DashboardWrapper>
  );
}


function Description({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <p className={cn("text-xs font-medium text-muted-foreground", className)}>{children}</p>
  );
}

function Value({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={cn("text-xs tracking-tight text-foreground", className)}>{children}</div>
  );
}

function Card2({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={cn('space-y-0 flex', className)}>
      {children}
    </div>
  )
}