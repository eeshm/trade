'use client';

import { useEffect, useState } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { useTradingStore } from '@/store/trading';
import { useWebSocket } from '@/hooks/useWebSocket';
import { apiClient } from '@/lib/api-client';
import { WalletConnect } from '@/components/wallet-connect';
import { PortfolioSummary } from '@/components/dashboard/portfolio-summary';
import { PriceChart } from '@/components/dashboard/price-chart';
import { OrderForm } from '@/components/dashboard/order-form';
import { OrderHistory } from '@/components/dashboard/order-history';
import { PortfolioSkeleton, OrderHistorySkeleton } from '@/components/ui/skeleton';
import { ChartErrorBoundary } from '@/components/error-boundary';

export default function TradePage() {
  const { isAuthenticated, token, hasHydrated } = useAuth();
  const [isLoadingPortfolio, setIsLoadingPortfolio] = useState(false);
  const [isLoadingOrders, setIsLoadingOrders] = useState(false);
  const setBalances = useTradingStore((state) => state.setBalances);
  const setPositions = useTradingStore((state) => state.setPositions);
  const setOrders = useTradingStore((state) => state.setOrders);

  const orders = useTradingStore((state) => state.orders);
  const balances = useTradingStore((state) => state.balances);
  const positions = useTradingStore((state) => state.positions);
  const prices = useTradingStore((state) => state.prices);

  const { isConnected: wsConnected, subscribe } = useWebSocket({
    token: hasHydrated ? token : null,
    enabled: true,
  });

  useEffect(() => {
    if (isAuthenticated && token) {
      const loadData = async () => {
        setIsLoadingPortfolio(true);
        setIsLoadingOrders(true);

        try {
          const [portfolio, fetchedOrders] = await Promise.all([
            apiClient.getPortfolio(),
            apiClient.getOrders(),
          ]);

          setBalances(portfolio.balances);
          setPositions(portfolio.positions);
          setOrders(fetchedOrders);
        } catch (error) {
          console.error('Failed to load data:', error);
        } finally {
          setIsLoadingPortfolio(false);
          setIsLoadingOrders(false);
        }
      };

      loadData();
    }
  }, [isAuthenticated, token, setBalances, setPositions, setOrders]);

  useEffect(() => {
    if (wsConnected) {
      subscribe('prices');

      if (isAuthenticated) {
        subscribe('portfolio');
        subscribe('orders');
      }
    }
  }, [wsConnected, subscribe, isAuthenticated]);

  return (
    <div className="min-h-screen bg-background text-foreground font-sans selection:bg-primary/20">
      <header className="sticky top-0 z-40 bg-background">
        <div className="w-full px-4 h-14 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <h1 className="text-sm font-medium tracking-tight text-foreground">paper.fun</h1>
          </div>
          <WalletConnect />
        </div>
      </header>

      <main className="w-full min-h-[calc(100vh-4rem)] p-4 space-y-4">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
          <div className="lg:col-span-9 min-h-[600px]">
            <ChartErrorBoundary>
              <PriceChart prices={prices} />
            </ChartErrorBoundary>
          </div>
          <div className="lg:col-span-3 ">
            <OrderForm />
          </div>

          <div className="lg:col-span-9 h-[450px]">
            {isLoadingOrders ? (
              <OrderHistorySkeleton />
            ) : (
              <OrderHistory orders={orders} />
            )}
          </div>
          <div className="lg:col-span-3 h-[200px] lg:h-[450px]">
            {isLoadingPortfolio ? (
              <PortfolioSkeleton />
            ) : (
              <PortfolioSummary balances={balances} positions={positions} className="h-full" />
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
