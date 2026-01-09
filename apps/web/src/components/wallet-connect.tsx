'use client';

import React from 'react';
import { useWallet } from '@solana/wallet-adapter-react';
import { WalletMultiButton } from '@solana/wallet-adapter-react-ui';
import { useAuth } from "../hooks/useAuth";
import { Button } from './ui/button';
import { LogOut } from 'lucide-react';

export function WalletConnect() {
  const { connected } = useWallet();
  const { isAuthenticated, user, logout } = useAuth();

  if (!connected) {
    return (
      <div className="flex items-center gap-2">
        <WalletMultiButton style={{ backgroundColor: 'hsl(var(--primary))', color: 'hsl(var(--primary-foreground))' }} />
      </div>
    );
  }

  if (isAuthenticated && user) {
    return (
      <div className="flex items-center gap-4">
        <div className="text-sm text-muted-foreground">
          {user.walletAddress.slice(0, 4)}...
          {user.walletAddress.slice(-4)}
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={logout}
          className="flex items-center gap-2"
        >
          <LogOut className="w-4 h-4" />
          Logout
        </Button>
      </div>
    );
  }

  return (
    <div>
      <WalletMultiButton style={{ backgroundColor: 'hsl(var(--primary))', color: 'hsl(var(--primary-foreground))' }} />
    </div>
  );
}
