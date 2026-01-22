import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { Balance, Position, PriceData, Order } from '@/types';

interface TradingStore {
  balances: Balance[];
  positions: Position[];
  orders: Order[];
  prices: { [symbol: string]: PriceData };
  isLoading: boolean;
  error: string | null;

  setBalances: (balances: Balance[]) => void;
  setPositions: (positions: Position[]) => void;
  setOrders: (orders: Order[]) => void;
  addOrder: (order: Order) => void;
  updateOrder: (orderId: number, updates: Partial<Order>) => void;
  setPrice: (symbol: string, priceData: PriceData) => void;
  setLoading: (isLoading: boolean) => void;
  setError: (error: string | null) => void;
  reset: () => void;
}

export const useTradingStore = create<TradingStore>()(
  persist(
    (set) => ({
      balances: [],
      positions: [],
      orders: [],
      prices: {},
      isLoading: false,
      error: null,

      setBalances: (balances) => set({ balances }),
      setPositions: (positions) => set({ positions }),
      setOrders: (orders) => set({ orders }),
      addOrder: (order) =>
        set((state) => ({
          orders: [order, ...state.orders],
        })),
      updateOrder: (orderId, updates) =>
        set((state) => ({
          orders: state.orders.map((o) =>
            o.orderId === orderId ? { ...o, ...updates } : o
          ),
        })),
      setPrice: (symbol, priceData) =>
        set((state) => ({
          prices: { ...state.prices, [symbol]: priceData },
        })),
      setLoading: (isLoading) => set({ isLoading }),
      setError: (error) => set({ error }),
      reset: () =>
        set({
          balances: [],
          positions: [],
          orders: [],
          prices: {},
          isLoading: false,
          error: null,
        }),
    }),
    {
      name: 'trading-store',
      storage: createJSONStorage(() => localStorage),
      // Only persist prices - balances/orders come from API
      partialize: (state) => ({ prices: state.prices }),
    }
  )
);
