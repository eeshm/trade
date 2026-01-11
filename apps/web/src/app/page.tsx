'use client';

import { useRouter } from 'next/navigation';
import { useEffect } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { useTradingStore } from '@/store/trading';
import { useWebSocket } from '@/hooks/useWebSocket';
import { apiClient } from '@/lib/api-client';
import { WalletConnect } from '@/components/wallet-connect';
import { PortfolioSummary } from '@/components/dashboard/portfolio-summary';
import { PriceChart } from '@/components/dashboard/price-chart';
import { OrderForm } from '@/components/dashboard/order-form';
import { OrderHistory } from '@/components/dashboard/order-history';

export default function Home() {
  const router = useRouter();
  const { isAuthenticated, token } = useAuth();
  const { setBalances, setPositions, setOrders } = useTradingStore();
  const tradingStore = useTradingStore();
  const { isConnected: wsConnected, subscribe } = useWebSocket({
    token,
    enabled: isAuthenticated,
  });

  // Load portfolio data from backend on mount
  useEffect(() => {
    if (isAuthenticated && token) {
      const loadPortfolio = async () => {
        try {
          const portfolio = await apiClient.getPortfolio();
          setBalances(portfolio.balances);
          setPositions(portfolio.positions);
        } catch (error) {
          console.error('Failed to load portfolio:', error);
        }
      };

      const loadOrders = async () => {
        try {
          const fetchedOrders = await apiClient.getOrders();
          setOrders(fetchedOrders);
        } catch (error) {
          console.error('Failed to load orders:', error);
        }
      };

      loadPortfolio();
      loadOrders();
    }
  }, [isAuthenticated, token, setBalances, setPositions, setOrders]);

  useEffect(() => {
    // Subscribe to real-time updates
    if (wsConnected) {
      subscribe('prices');
      subscribe('portfolio');
      subscribe('orders');
    }
  }, [wsConnected, subscribe]);

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="sticky top-0 z-40 border-b border-border bg-background/95 backdrop-blur">
        <div className="max-w-360  mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-foreground">Paper Trading</h1>
              <p className="text-sm text-muted-foreground">
                WebSocket: {wsConnected ? '🟢 Connected' : '🔴 Disconnected'}
              </p>
            </div>
            <WalletConnect />
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-360 mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Portfolio Summary */}
        <PortfolioSummary
          balances={tradingStore.balances}
          positions={tradingStore.positions}
        />

        {/* Trading Section */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 mt-8">
          {/* Left Column: Chart and Order Form */}
          <div className="lg:col-span-2 space-y-8">
            <PriceChart prices={tradingStore.prices} />
            <OrderForm />
          </div>

          {/* Right Column: Order History */}
          <div>
            <OrderHistory orders={tradingStore.orders} />
          </div>
        </div>
      </main>
    </div>
  );
}