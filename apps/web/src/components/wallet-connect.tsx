'use client';

import React, { useEffect, useState } from 'react';
import { useWallet } from '@solana/wallet-adapter-react';
import { useWalletModal } from '@solana/wallet-adapter-react-ui';
import { useAuth } from "../hooks/useAuth";
import { useTradingStore } from '@/store/trading';
import { Button } from './ui/button';
import { Copy } from 'lucide-react';
import { toast } from 'sonner';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";

interface WalletConnectProps {
  className?: string;
}

export function WalletConnect({ className }: WalletConnectProps) {
  const { connected, publicKey, disconnect } = useWallet();
  const { setVisible } = useWalletModal();
  const { isAuthenticated, logout, login } = useAuth();
  const resetTradingStore = useTradingStore((state) => state.reset);
  const [hasAttemptedLogin, setHasAttemptedLogin] = useState(false);
  const walletReady = connected || !!publicKey;
  const walletAddress = publicKey?.toBase58();

  // Auto-trigger login when wallet connects
  useEffect(() => {
    const autoLogin = async () => {
      if (walletReady && !isAuthenticated && !hasAttemptedLogin) {
        setHasAttemptedLogin(true);
        try {
          await login();
        } catch (error) {
          // User cancelled or login failed
          console.log('Auto-login cancelled or failed');
        }
      }
    };

    autoLogin();
  }, [walletReady, isAuthenticated, hasAttemptedLogin, login]);

  // Reset attempt flag when wallet disconnects
  useEffect(() => {
    if (!walletReady) {
      setHasAttemptedLogin(false);
    }
  }, [walletReady]);

  const copyAddress = () => {
    if (walletAddress) {
      navigator.clipboard.writeText(walletAddress);
      toast.success('Address copied to clipboard');
    }
  };

  const handleDisconnect = async () => {
    await disconnect();
    logout();
    resetTradingStore();
    setHasAttemptedLogin(false);
  };

  const handleSignIn = async () => {
    try {
      await login();
    } catch (error) {
      // Error already handled by useAuth
    }
  };

  // Not connected - show Connect Wallet button
  if (!walletReady) {
    return (
      <Button
        type="button"
        onClick={() => setVisible(true)}
        variant="secondary"
        className={cn("font-medium rounded-xs w-32 h-10", className)}
      >
        Connect Wallet
      </Button>
    );
  }

  // Connected but not authenticated - show Sign in to Trade button
  if (!isAuthenticated) {
    return (
      <Button
        type="button"
        onClick={handleSignIn}
        variant="secondary"
        className={cn("font-medium rounded-xs w-32 h-8", className)}
      >
        Sign in to Trade
      </Button>
    );
  }

  // Connected and authenticated - show wallet dropdown
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button type="button" variant="outline" className="font-mono outline-0 h-8  w-32 hover:border-none border-none rounded-xs hover:outline-0 hover:bg-border hover:cursor-pointer bg-border/80">
          {walletAddress ? `${walletAddress.slice(0, 4)}...${walletAddress.slice(-6)}` : 'Connected'}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="min-w-32 bg-border">
        <DropdownMenuItem onClick={copyAddress} className='hover:bg-card/60 hover:cursor-pointer'>
          <Copy className="mr-0 h-4 w-4" />
          {walletAddress ? `${walletAddress.slice(0, 4)}...${walletAddress.slice(-6)}` : 'Wallet'}
        </DropdownMenuItem>
        <DropdownMenuItem onClick={handleDisconnect} className='hover:bg-card/60 hover:cursor-pointer'>
          <span>Disconnect</span>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
