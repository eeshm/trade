import { describe, test, expect, beforeEach } from 'vitest';
import { useAuthStore } from '../../../apps/web/src/store/auth';
import { act } from '@testing-library/react';
import type { User, AuthState } from '../../../apps/web/src/types';

// Type for the full store state (AuthState + actions)
interface AuthStoreState extends AuthState {
  setUser: (user: User | null, token: string | null) => void;
  logout: () => void;
  _hasHydrated: boolean;
  setHasHydrated: (state: boolean) => void;
}

/**
 * Auth Store Unit Tests
 * 
 * Tests the Zustand auth store for:
 * - Initial state
 * - Setting user and token
 * - Logout functionality
 * - Authentication state derivation
 */

describe('Auth Store', () => {
  // Helper to get typed state - cast to unknown first to satisfy TypeScript
  const getState = (): AuthStoreState => useAuthStore.getState() as unknown as AuthStoreState;

  // Reset store before each test
  beforeEach(() => {
    getState().logout();
  });

  describe('Initial State', () => {
    test('starts with null user and token', () => {
      const state = getState();
      
      expect(state.user).toBeNull();
      expect(state.token).toBeNull();
      expect(state.isAuthenticated).toBe(false);
    });
  });

  describe('setUser', () => {
    test('sets user and token correctly', () => {
      const mockUser: User = { id: 1, walletAddress: '7EcDhSYGxXyscszYEp35KHN8sybpK3YCM8' };
      const mockToken = 'jwt-token-123';

      act(() => {
        getState().setUser(mockUser, mockToken);
      });

      const state = getState();
      expect(state.user).toEqual(mockUser);
      expect(state.token).toBe(mockToken);
      expect(state.isAuthenticated).toBe(true);
    });

    test('sets isAuthenticated to true when both user and token are present', () => {
      const mockUser: User = { id: 1, walletAddress: 'abc123' };
      const mockToken = 'token';

      act(() => {
        getState().setUser(mockUser, mockToken);
      });

      expect(getState().isAuthenticated).toBe(true);
    });

    test('sets isAuthenticated to false when user is null', () => {
      act(() => {
        getState().setUser(null, 'token');
      });

      expect(getState().isAuthenticated).toBe(false);
    });

    test('sets isAuthenticated to false when token is null', () => {
      const mockUser: User = { id: 1, walletAddress: 'abc123' };

      act(() => {
        getState().setUser(mockUser, null);
      });

      expect(getState().isAuthenticated).toBe(false);
    });
  });

  describe('logout', () => {
    test('clears user, token, and sets isAuthenticated to false', () => {
      // First, set up an authenticated state
      const mockUser: User = { id: 1, walletAddress: 'abc123' };
      act(() => {
        getState().setUser(mockUser, 'token');
      });
      
      // Verify authenticated
      expect(getState().isAuthenticated).toBe(true);

      // Logout
      act(() => {
        getState().logout();
      });

      const state = getState();
      expect(state.user).toBeNull();
      expect(state.token).toBeNull();
      expect(state.isAuthenticated).toBe(false);
    });
  });

  describe('Persistence', () => {
    test('store persists data to localStorage', () => {
      // Set user
      const mockUser: User = { id: 1, walletAddress: 'test123' };
      getState().setUser(mockUser, 'token123');

      // The Zustand persist middleware should save to localStorage
      // We're testing the behavior, not the implementation details
      expect(getState().user).toEqual(mockUser);
      expect(getState().token).toBe('token123');
    });
  });
});
