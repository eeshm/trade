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
    <div className="min-h-screen bg-background text-foreground font-sans selection:bg-primary/20">
      {/* Header */}
      <header className="sticky top-0 z-40 border-b border-border bg-background/80 backdrop-blur-md">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <h1 className="text-xl font-semibold tracking-tight">Paper Trading</h1>
            <div className={`px-2 py-0.5 rounded-full text-xs font-medium border ${wsConnected
                ? 'bg-green-500/10 text-green-500 border-green-500/20'
                : 'bg-red-500/10 text-red-500 border-red-500/20'
              }`}>
              {wsConnected ? 'Live' : 'Disconnected'}
            </div>
          </div>
          <WalletConnect />
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
        {/* Portfolio Summary */}
        <PortfolioSummary
          balances={tradingStore.balances}
          positions={tradingStore.positions}
        />

        {/* Trading Section */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Left Column: Chart and Order Form */}
          <div className="lg:col-span-8 space-y-6">
            <PriceChart prices={tradingStore.prices} />
            <OrderForm />
          </div>

          {/* Right Column: Order History */}
          <div className="lg:col-span-4">
            <OrderHistory orders={tradingStore.orders} />
          </div>
        </div>
      </main>
    </div>
  );
}