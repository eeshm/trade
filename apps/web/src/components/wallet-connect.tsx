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
        <WalletMultiButton className="bg-zinc-800! text-white! hover:bg-zinc-700! h-9! rounded-md! px-4! text-sm! font-medium! border! border-zinc-700!" />
      </div>
    );
  }

  if (isAuthenticated && user) {
    return (
      <div className="flex items-center gap-4">
        <div className="text-sm text-muted-foreground hidden sm:block">
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
      <WalletMultiButton className="bg-zinc-800! text-white! hover:bg-zinc-700! h-9! rounded-md! px-4! text-sm! font-medium! border! border-zinc-700!" />
    </div>
  );
}
