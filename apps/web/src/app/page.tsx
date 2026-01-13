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

  // WebSocket is always enabled for prices, token is optional for auth
  const { isConnected: wsConnected, subscribe } = useWebSocket({
    token,
    enabled: true, // Always enabled for price feed
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

  // Subscribe to prices always, portfolio/orders only when authenticated
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
      {/* Header */}
      <header className="sticky top-0 z-40 bg-background">
        <div className="w-full px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <h1 className="text-sm font-medium tracking-tight text-foreground">Paper Trading</h1>
            <div className={`px-2 py-0.5 rounded text-[10px] font-medium ${wsConnected
              ? 'bg-green-500/10 text-green-500'
              : 'bg-red-500/10 text-red-500'
              }`}>
              {wsConnected ? '● Live' : '○ Offline'}
            </div>
          </div>
          <WalletConnect />
        </div>
      </header>

      {/* Main Content */}
      <main className="w-full min-h-[calc(100vh-4rem)] p-4 space-y-4">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
          {/* Top Row: Chart (Left 3/4) and Order Form (Right 1/4) */}
          <div className="lg:col-span-9 min-h-[600px]">
            <PriceChart prices={tradingStore.prices} />
          </div>
          <div className="lg:col-span-3 ">
            <OrderForm />
          </div>

          {/* Bottom Row: Order History (Left 3/4) and Portfolio Summary (Right 1/4) */}
          <div className="lg:col-span-9 h-[450px]">
            <OrderHistory orders={Array.isArray(tradingStore.orders) ? tradingStore.orders : []} />
          </div>
          <div className="lg:col-span-3 h-[200px] lg:h-[450px]">
            <PortfolioSummary
              balances={Array.isArray(tradingStore.balances) ? tradingStore.balances : []}
              positions={Array.isArray(tradingStore.positions) ? tradingStore.positions : []}
              className="h-full"
            />
          </div>
        </div>
      </main>
    </div>
  );
}