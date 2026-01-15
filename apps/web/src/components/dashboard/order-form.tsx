'use client';

import { useState } from 'react';
import { OrderSide } from '@/types';
import { apiClient } from '@/lib/api-client';
import { useTradingStore } from '@/store/trading';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { DashboardWrapper } from '@/components/dashboard-wrapper';
import { Card, CardContent } from '@/components/ui/card';
import { Loader2, ChevronDown } from 'lucide-react';
import { toast } from 'sonner';
import { useWallet } from '@solana/wallet-adapter-react';
import { WalletConnect } from '@/components/wallet-connect';
import { useAuth } from '@/hooks/useAuth';
import { useAuthStore } from '@/store/auth';
import { formatCurrency } from '@/lib/utils';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

export function OrderForm() {
  const [side, setSide] = useState<OrderSide>('buy');
  const [size, setSize] = useState('');
  const [currency, setCurrency] = useState<'SOL' | 'USDC'>('SOL');
  const [isLoading, setIsLoading] = useState(false);
  const { addOrder, prices, balances } = useTradingStore();
  const { connected } = useWallet();
  const { login } = useAuth();

  // Subscribe directly to auth store for proper reactivity
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);

  console.log('OrderForm render - connected:', connected, 'isAuthenticated:', isAuthenticated);

  // Defensive check: ensure balances is an array
  const safeBalances = Array.isArray(balances) ? balances : [];
  const usdcBalance = safeBalances.find((b) => b.asset === 'USDC');
  const solBalance = safeBalances.find((b) => b.asset === 'SOL');
  const solPrice = parseFloat(prices.SOL?.price) || 0;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const numericSize = parseFloat(size);
    if (!size || numericSize <= 0) {
      toast.error('Please enter a valid amount');
      return;
    }

    let solAmount = numericSize;
    if (currency === 'USDC') {
      solAmount = numericSize / solPrice;
    }

    if (solAmount < 0.01) {
      toast.error('Minimum order size is 0.01 SOL');
      return;
    }

    setIsLoading(true);
    try {
      const order = await apiClient.placeOrder({
        side,
        baseAsset: 'SOL',
        quoteAsset: 'USDC',
        requestedSize: solAmount.toString(),
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

  const numericAmount = parseFloat(size) || 0;
  const estimatedValue = currency === 'SOL'
    ? numericAmount * solPrice
    : numericAmount / solPrice;

  // Calculate available balance based on side and currency
  const availableUSDC = parseFloat(usdcBalance?.available || '0');
  const availableSOL = parseFloat(solBalance?.available || '0');

  // Check for insufficient funds
  const hasInsufficientFunds = (() => {
    if (!numericAmount || numericAmount <= 0) return false;

    if (side === 'buy') {
      // Buying SOL: need USDC
      const requiredUSDC = currency === 'USDC' ? numericAmount : numericAmount * solPrice;
      return requiredUSDC > availableUSDC;
    } else {
      // Selling SOL: need SOL
      const requiredSOL = currency === 'SOL' ? numericAmount : numericAmount / solPrice;
      return requiredSOL > availableSOL;
    }
  })();

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
            {/* Available Balance */}
            <div className='flex text-xs text-muted-foreground'>
              Available to trade:
              <span className='ml-auto'>
                {side === 'buy'
                  ? formatCurrency(availableUSDC)
                  : `${availableSOL.toFixed(4)} SOL`
                }
              </span>
            </div>

            {/* Amount Input */}
            <div className="space-y-2">
              <label className="text-xs font-medium text-muted-foreground">
                Amount
              </label>
              <div className="relative">
                <Input
                  type="text"
                  onChange={(e) => {
                    const value = e.target.value;
                    if (value === '' || /^\d*\.?\d*$/.test(value)) {
                      setSize(value);
                    }
                  }}
                  value={size}
                  className="text-right pr-20"
                  placeholder={currency == "SOL" ? "0.0000" : "0.00"}
                />
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground pointer-events-none">
                  Amount
                </span>
                <div className="absolute right-1 top-1 bottom-1">
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="sm" className="h-full gap-1 text-xs font-medium px-2">
                        {currency}
                        <ChevronDown className="h-3 w-3" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className='bg-card min-w-16'>
                      <DropdownMenuItem onClick={() => setCurrency('SOL')}>SOL</DropdownMenuItem>
                      <DropdownMenuItem onClick={() => setCurrency('USDC')}>USDC</DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              </div>
              <p className="text-xs text-muted-foreground">
                {currency === 'SOL'
                  ? `≈ ${formatCurrency(estimatedValue)}`
                  : `≈ ${estimatedValue.toFixed(4)} SOL`
                }
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
                  ${(currency === 'SOL' ? estimatedValue * 0.001 : numericAmount * 0.001).toFixed(2)}
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
                className="w-full rounded-xs"
              >
                Sign In to Trade
              </Button>
            ) : (
              <Button
                type="submit"
                disabled={isLoading || !size || hasInsufficientFunds}
                className={`w-full rounded-xs ${hasInsufficientFunds
                  ? 'bg-gray-500 hover:bg-gray-500 cursor-not-allowed'
                  : side === 'buy'
                    ? 'bg-green-600 hover:bg-green-700'
                    : 'bg-red-600 hover:bg-red-700'
                  }`}
              >
                {isLoading ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Placing Order...
                  </>
                ) : hasInsufficientFunds ? (
                  'Insufficient Funds'
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
