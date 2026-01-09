'use client';

import { useState } from 'react';
import { OrderSide } from '@/types';
import { apiClient } from '@/lib/api-client';
import { useTradingStore } from '@/store/trading';
import { Button } from '@/components/ui/button';
import { Loader2 } from 'lucide-react';
import { toast } from 'sonner';

export function OrderForm() {
  const [side, setSide] = useState<OrderSide>('buy');
  const [size, setSize] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const { addOrder, prices } = useTradingStore();

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
    <div className="bg-slate-800 rounded-lg p-6 border border-slate-700">
      <h2 className="text-xl font-bold text-white mb-6">Place Order</h2>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Side Selection */}
        <div className="flex gap-4">
          <button
            type="button"
            onClick={() => setSide('buy')}
            className={`flex-1 py-3 rounded-lg font-medium transition-colors ${
              side === 'buy'
                ? 'bg-green-600 text-white'
                : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
            }`}
          >
            Buy SOL
          </button>
          <button
            type="button"
            onClick={() => setSide('sell')}
            className={`flex-1 py-3 rounded-lg font-medium transition-colors ${
              side === 'sell'
                ? 'bg-red-600 text-white'
                : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
            }`}
          >
            Sell SOL
          </button>
        </div>

        {/* Size Input */}
        <div>
          <label className="block text-sm font-medium text-slate-300 mb-2">
            Size (SOL)
          </label>
          <input
            type="number"
            step="0.01"
            min="0.01"
            value={size}
            onChange={(e) => setSize(e.target.value)}
            placeholder="Enter SOL amount"
            className="w-full px-4 py-3 bg-slate-700 border border-slate-600 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:border-purple-500"
          />
          <p className="text-xs text-slate-400 mt-2">
            Estimated cost: ${estimatedCost.toFixed(2)} USDC
          </p>
        </div>

        {/* Order Details */}
        <div className="bg-slate-700 rounded p-4 text-sm space-y-2">
          <div className="flex justify-between text-slate-300">
            <span>Price per SOL:</span>
            <span className="text-white">${solPrice.toFixed(2)}</span>
          </div>
          <div className="flex justify-between text-slate-300">
            <span>Order Type:</span>
            <span className="text-white">Market</span>
          </div>
          <div className="flex justify-between text-slate-300">
            <span>Fee (0.1%):</span>
            <span className="text-white">
              ${(estimatedCost * 0.001).toFixed(2)}
            </span>
          </div>
        </div>

        {/* Submit Button */}
        <Button
          type="submit"
          disabled={isLoading || !size}
          className={`w-full h-12 text-base font-medium ${
            side === 'buy'
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
      </form>
    </div>
  );
}
