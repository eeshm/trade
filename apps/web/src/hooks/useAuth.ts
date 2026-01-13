import { useCallback } from 'react';
import { useWallet } from '@solana/wallet-adapter-react';
// import { signMessage } from '@solana/wallet-adapter-base';
import bs58 from 'bs58';
import { apiClient } from '../lib/api-client';
import { useAuthStore } from '../store/auth';
import { toast } from 'sonner';

export function useAuth() {
  const { publicKey, signMessage: walletSignMessage } = useWallet();
  const authStore = useAuthStore();

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

      const signature = await walletSignMessage(message);
      const signatureString = bs58.encode(signature);

      // Step 3: Send signature to backend for login
      const loginResponse = await apiClient.login({
        walletAddress: publicKey.toBase58(),
        signature: signatureString,
        nonce,
      });

      // Store auth state
      authStore.setUser(loginResponse.user, loginResponse.token);
      toast.success('Logged in successfully!');

      return loginResponse;
    } catch (error) {
      console.error('Login failed:', await error);
      toast.error('Failed to login. Please try again.');
      throw error;
    }
  }, [publicKey, walletSignMessage, authStore, getNonce]);

  const logout = useCallback(async () => {
    try {
      await apiClient.logout();
      authStore.logout();
      toast.success('Logged out successfully');
    } catch (error) {
      console.error('Logout error:', error);
      // Still clear local state even if API call fails
      authStore.logout();
      toast.success('Logged out');
    }
  }, [authStore]);

  return {
    publicKey: publicKey?.toBase58(),
    isConnected: !!publicKey,
    user: authStore.user,
    token: authStore.token,
    isAuthenticated: authStore.isAuthenticated,
    login,
    logout,
    getNonce,
  };
}
