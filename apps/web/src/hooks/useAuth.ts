import { useCallback } from 'react';
import { useWallet } from '@solana/wallet-adapter-react';
import bs58 from 'bs58';
import { apiClient } from '../lib/api-client';
import { useAuthStore } from '../store/auth';
import { toast } from 'sonner';

export function useAuth() {
  const { publicKey, signMessage: walletSignMessage } = useWallet();
  
  // Subscribe to individual store values for proper reactivity
  const user = useAuthStore((state) => state.user);
  const token = useAuthStore((state) => state.token);
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);
  const hasHydrated = useAuthStore((state) => state._hasHydrated);
  const setUser = useAuthStore((state) => state.setUser);
  const logoutStore = useAuthStore((state) => state.logout);

  const getNonce = useCallback(async () => {
    if (!publicKey) {
      throw new Error('Wallet not connected');
    }

    try {
      const response = await apiClient.getNonce(publicKey.toBase58());
      return response;
    } catch (error) {
      console.error('Failed to get nonce:', error);
      throw error;
    }
  }, [publicKey]);

  const login = useCallback(async () => {
    if (!publicKey) {
      throw new Error('Wallet not connected');
    }

    try {
      // Step 1: Get nonce from backend
      const { nonce } = await getNonce();

      // Step 2: Sign message with wallet
      const message = new TextEncoder().encode(
        `Sign this nonce: ${nonce}`
      );
      
      if (!walletSignMessage) {
        throw new Error('Wallet does not support signing');
      }

      let signature: Uint8Array;
      try {
        signature = await walletSignMessage(message);
      } catch (signError: any) {
        console.error('Wallet signing failed:', signError);
        if (signError?.name === 'WalletSignMessageError') {
          toast.error('Wallet signing was cancelled or failed. Please try again.');
        } else {
          toast.error('Failed to sign message with wallet.');
        }
        throw signError;
      }
      
      const signatureString = bs58.encode(signature);

      // Step 3: Send signature to backend for login
      const loginResponse = await apiClient.login({
        walletAddress: publicKey.toBase58(),
        signature: signatureString,
        nonce,
      });

      
      // Transform backend response to match frontend expected format
      // Backend returns { token, userId, walletAddress, expiresAt }
      // Frontend expects { token, user: { id, walletAddress } }
      const user = loginResponse.user || (loginResponse as any).userId ? {
        id: (loginResponse as any).userId,
        walletAddress: (loginResponse as any).walletAddress || publicKey.toBase58(),
      } : null;
      
      // Store auth state
      setUser(user, loginResponse.token);
      toast.success('Logged in successfully!');

      return loginResponse;
    } catch (error: any) {
      console.error('Login failed:', error);
      // Only show generic error if not already shown by wallet signing
      if (error?.name !== 'WalletSignMessageError') {
        toast.error('Failed to login. Please try again.');
      }
      throw error;
    }
  }, [publicKey, walletSignMessage, setUser, getNonce]);

  const logout = useCallback(async () => {
    try {
      await apiClient.logout();
      logoutStore();
      toast.success('Logged out successfully');
    } catch (error) {
      console.error('Logout error:', error);
      // Still clear local state even if API call fails
      logoutStore();
      toast.success('Logged out');
    }
  }, [logoutStore]);

  return {
    publicKey: publicKey?.toBase58(),
    isConnected: !!publicKey,
    user,
    token,
    isAuthenticated,
    hasHydrated, // True when localStorage has been loaded
    login,
    logout,
    getNonce,
  };
}
