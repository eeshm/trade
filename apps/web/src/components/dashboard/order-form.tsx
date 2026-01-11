'use client';

import { useState } from 'react';
import { OrderSide } from '@/types';
import { apiClient } from '@/lib/api-client';
import { useTradingStore } from '@/store/trading';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { DashboardWrapper } from '@/components/dashboard-wrapper';
import { Card, CardContent } from '@/components/ui/card';
import { Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { useWallet } from '@solana/wallet-adapter-react';
import { WalletConnect } from '@/components/wallet-connect';
import { useAuth } from '@/hooks/useAuth';
import { formatCurrency } from '@/lib/utils';

export function OrderForm() {
  const [side, setSide] = useState<OrderSide>('buy');
  const [size, setSize] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const { addOrder, prices, balances } = useTradingStore();
  const { connected } = useWallet();
  const { isAuthenticated, login } = useAuth();

  const usdcBalance = balances.find((b) => b.asset === 'USDC');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!size || parseFloat(size) <= 0) {
      toast.error('Please enter a valid size');
      return;
    }

    if (parseFloat(size) < 0.01) {
      toast.error('Minimum order size is 0.01 SOL');
      return;
    }

    setIsLoading(true);
    try {
      const order = await apiClient.placeOrder({
        side,
        baseAsset: 'SOL',
        quoteAsset: 'USDC',
        requestedSize: size,
      });

      addOrder(order);
      toast.success(`${side.toUpperCase()} order placed!`);
      setSize('');
    } catch (error) {
      console.error('Order failed:', error);
      toast.error('Failed to place order');
    } finally {
      setIsLoading(false);
    }
  };

  const solPrice = parseFloat(prices.SOL?.price);
  const estimatedCost = (parseFloat(size) || 0) * solPrice;

  return (
    <DashboardWrapper name="Place Order" className="h-full">
      <Card className="h-full overflow-hidden">
        <CardContent className="h-full overflow-y-auto">
          <form onSubmit={handleSubmit} className="space-y-3">
            {/* Side Selection */}
            <div className="flex bg-card p-[2px]">
              <Button
                type="button"
                variant={side === 'buy' ? 'default' : 'outline'}
                onClick={() => setSide('buy')}
                className={`flex-1 rounded-xs ${side === 'buy' ? 'bg-green-600 hover:bg-green-700 text-white' : ''}`}
              >
                Buy SOL
              </Button>
              <Button
                type="button"
                variant={side === 'sell' ? 'default' : 'outline'}
                onClick={() => setSide('sell')}
                className={`flex-1 rounded-xs ${side === 'sell' ? 'bg-red-600 hover:bg-red-700 text-white' : ''}`}
              >
                Sell SOL
              </Button>
            </div>
            {/* Make the balance to end */}
            <div className='flex text-xs text-muted-foreground'>
              Available to trade:
              <span className='ml-auto'>
                {formatCurrency(usdcBalance?.available || 0)}
              </span>
            </div>

            {/* Size Input */}
            <div className="space-y-2">
              <label className="text-xs font-medium text-muted-foreground">
                Size (SOL)
              </label>
              <Input
                type="text"
                value={size}
                onChange={(e) => {
                  const value = e.target.value;
                  if (value === '' || /^\d*\.?\d*$/.test(value)) {
                    setSize(value);
                  } else {
                  }
                }}
                placeholder="Enter SOL amount"
              />
              <p className="text-xs text-muted-foreground">
                Estimated cost: ${estimatedCost.toFixed(5)} USDC
              </p>
            </div>

            {/* Order Details */}
            <div className="text-xs space-y-2">
              <div className="flex justify-between text-muted-foreground">
                <span>Price per SOL:</span>
                <span className="text-foreground">${solPrice.toFixed(2)}</span>
              </div>
              <div className="flex justify-between text-muted-foreground">
                <span>Order Type:</span>
                <span className="text-foreground">Market</span>
              </div>
              <div className="flex justify-between text-muted-foreground">
                <span>Fee (0.1%):</span>
                <span className="text-foreground">
                  ${(estimatedCost * 0.001).toFixed(2)}
                </span>
              </div>
            </div>

            {/* Submit Button */}
            {!connected ? (
              <div className="w-full flex justify-center">
                <WalletConnect className="w-full" />
              </div>
            ) : !isAuthenticated ? (
              <Button
                type="button"
                onClick={() => login()}
                className="w-full"
              >
                Sign In to Trade
              </Button>
            ) : (
              <Button
                type="submit"
                disabled={isLoading || !size}
                className={`w-full ${side === 'buy'
                  ? 'bg-green-600 hover:bg-green-700'
                  : 'bg-red-600 hover:bg-red-700'
                  }`}
              >
                {isLoading ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Placing Order...
                  </>
                ) : (
                  `${side === 'buy' ? 'Buy' : 'Sell'} SOL`
                )}
              </Button>
            )}
          </form>
        </CardContent>
      </Card>
    </DashboardWrapper>
  );
}
