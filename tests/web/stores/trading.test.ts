import { describe, test, expect, beforeEach } from 'vitest';
import { useTradingStore } from '../../../apps/web/src/store/trading';
import { act } from '@testing-library/react';
import type { Balance, Position, Order, PriceData } from '../../../apps/web/src/types';

/**
 * Trading Store Unit Tests
 * 
 * Tests the Zustand trading store for:
 * - Initial state
 * - Balance operations
 * - Position operations
 * - Order operations (set, add, update)
 * - Price updates
 * - Loading and error states
 * - Reset functionality
 */

describe('Trading Store', () => {
  // Reset store before each test
  beforeEach(() => {
    act(() => {
      useTradingStore.getState().reset();
    });
  });

  describe('Initial State', () => {
    test('starts with empty arrays and default values', () => {
      const state = useTradingStore.getState();
      
      expect(state.balances).toEqual([]);
      expect(state.positions).toEqual([]);
      expect(state.orders).toEqual([]);
      expect(state.prices).toEqual({});
      expect(state.isLoading).toBe(false);
      expect(state.error).toBeNull();
    });
  });

  describe('Balances', () => {
    test('setBalances updates balances array', () => {
      const mockBalances: Balance[] = [
        { asset: 'USDC', available: '1000.00', locked: '0' },
        { asset: 'SOL', available: '5.5', locked: '0' },
      ];

      act(() => {
        useTradingStore.getState().setBalances(mockBalances);
      });

      expect(useTradingStore.getState().balances).toEqual(mockBalances);
    });

    test('setBalances replaces existing balances', () => {
      const initial: Balance[] = [{ asset: 'USDC', available: '500', locked: '0' }];
      const updated: Balance[] = [{ asset: 'USDC', available: '1000', locked: '0' }];

      act(() => {
        useTradingStore.getState().setBalances(initial);
      });
      
      act(() => {
        useTradingStore.getState().setBalances(updated);
      });

      expect(useTradingStore.getState().balances).toEqual(updated);
    });
  });

  describe('Positions', () => {
    test('setPositions updates positions array', () => {
      const mockPositions: Position[] = [
        { asset: 'SOL', size: '10', avgEntryPrice: '100.50' },
      ];

      act(() => {
        useTradingStore.getState().setPositions(mockPositions);
      });

      expect(useTradingStore.getState().positions).toEqual(mockPositions);
    });
  });

  describe('Orders', () => {
    const mockOrder: Order = {
      orderId: 1,
      side: 'buy',
      status: 'filled',
      baseAsset: 'SOL',
      quoteAsset: 'USDC',
      requestedSize: '1',
      executedPrice: '100.00',
      executedSize: '1',
      feesApplied: '0.10',
      createdAt: '2024-01-15T10:00:00Z',
      updatedAt: '2024-01-15T10:00:00Z',
    };

    test('setOrders updates orders array', () => {
      const orders = [mockOrder];

      act(() => {
        useTradingStore.getState().setOrders(orders);
      });

      expect(useTradingStore.getState().orders).toEqual(orders);
    });

    test('addOrder prepends new order to array', () => {
      const existingOrder: Order = { ...mockOrder, orderId: 1 };
      const newOrder: Order = { ...mockOrder, orderId: 2 };

      act(() => {
        useTradingStore.getState().setOrders([existingOrder]);
      });
      
      act(() => {
        useTradingStore.getState().addOrder(newOrder);
      });

      const orders = useTradingStore.getState().orders;
      expect(orders.length).toBe(2);
      expect(orders[0].orderId).toBe(2); // New order at front
      expect(orders[1].orderId).toBe(1); // Existing order at back
    });

    test('updateOrder updates specific order by orderId', () => {
      const orders = [
        { ...mockOrder, orderId: 1, status: 'pending' as const },
        { ...mockOrder, orderId: 2, status: 'pending' as const },
      ];

      act(() => {
        useTradingStore.getState().setOrders(orders);
      });
      
      act(() => {
        useTradingStore.getState().updateOrder(1, { status: 'filled' });
      });

      const updatedOrders = useTradingStore.getState().orders;
      expect(updatedOrders[0].status).toBe('filled');
      expect(updatedOrders[1].status).toBe('pending'); // Unchanged
    });

    test('updateOrder does nothing if orderId not found', () => {
      const orders = [{ ...mockOrder, orderId: 1 }];

      act(() => {
        useTradingStore.getState().setOrders(orders);
      });
      
      act(() => {
        useTradingStore.getState().updateOrder(999, { status: 'rejected' });
      });

      // Should remain unchanged
      expect(useTradingStore.getState().orders).toEqual(orders);
    });
  });

  describe('Prices', () => {
    test('setPrice adds new price data', () => {
      const priceData: PriceData = {
        symbol: 'SOL',
        price: '150.25',
        updatedAt: '2024-01-15T10:00:00Z',
      };

      act(() => {
        useTradingStore.getState().setPrice('SOL', priceData);
      });

      expect(useTradingStore.getState().prices['SOL']).toEqual(priceData);
    });

    test('setPrice updates existing price', () => {
      const initial: PriceData = { symbol: 'SOL', price: '100', updatedAt: 'old' };
      const updated: PriceData = { symbol: 'SOL', price: '150', updatedAt: 'new' };

      act(() => {
        useTradingStore.getState().setPrice('SOL', initial);
      });
      
      act(() => {
        useTradingStore.getState().setPrice('SOL', updated);
      });

      expect(useTradingStore.getState().prices['SOL'].price).toBe('150');
    });

    test('setPrice preserves other prices', () => {
      const solPrice: PriceData = { symbol: 'SOL', price: '100', updatedAt: '' };
      const btcPrice: PriceData = { symbol: 'BTC', price: '50000', updatedAt: '' };

      act(() => {
        useTradingStore.getState().setPrice('SOL', solPrice);
      });
      
      act(() => {
        useTradingStore.getState().setPrice('BTC', btcPrice);
      });

      const prices = useTradingStore.getState().prices;
      expect(prices['SOL']).toEqual(solPrice);
      expect(prices['BTC']).toEqual(btcPrice);
    });
  });

  describe('Loading State', () => {
    test('setLoading updates isLoading', () => {
      act(() => {
        useTradingStore.getState().setLoading(true);
      });
      expect(useTradingStore.getState().isLoading).toBe(true);

      act(() => {
        useTradingStore.getState().setLoading(false);
      });
      expect(useTradingStore.getState().isLoading).toBe(false);
    });
  });

  describe('Error State', () => {
    test('setError updates error message', () => {
      act(() => {
        useTradingStore.getState().setError('Something went wrong');
      });
      expect(useTradingStore.getState().error).toBe('Something went wrong');
    });

    test('setError can clear error with null', () => {
      act(() => {
        useTradingStore.getState().setError('Error');
      });
      
      act(() => {
        useTradingStore.getState().setError(null);
      });
      
      expect(useTradingStore.getState().error).toBeNull();
    });
  });

  describe('Reset', () => {
    test('reset clears all state to initial values', () => {
      // Set up some state
      act(() => {
        useTradingStore.getState().setBalances([{ asset: 'USDC', available: '100', locked: '0' }]);
        useTradingStore.getState().setOrders([{
          orderId: 1, side: 'buy', status: 'filled', baseAsset: 'SOL',
          quoteAsset: 'USDC', requestedSize: '1', executedPrice: '100',
          executedSize: '1', feesApplied: '0.1', createdAt: '', updatedAt: '',
        }]);
        useTradingStore.getState().setLoading(true);
        useTradingStore.getState().setError('Error');
      });

      // Reset
      act(() => {
        useTradingStore.getState().reset();
      });

      const state = useTradingStore.getState();
      expect(state.balances).toEqual([]);
      expect(state.positions).toEqual([]);
      expect(state.orders).toEqual([]);
      expect(state.prices).toEqual({});
      expect(state.isLoading).toBe(false);
      expect(state.error).toBeNull();
    });
  });
});
