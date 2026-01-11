'use client';

import React from 'react';
import { useWallet } from '@solana/wallet-adapter-react';
import { useWalletModal } from '@solana/wallet-adapter-react-ui';
import { useAuth } from "../hooks/useAuth";
import { Button } from './ui/button';
import { LogOut, Copy, Wallet } from 'lucide-react';
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
  const { isAuthenticated, logout } = useAuth();

  const copyAddress = () => {
    if (publicKey) {
      navigator.clipboard.writeText(publicKey.toBase58());
      toast.success('Address copied to clipboard');
    }
  };

  const handleDisconnect = async () => {
    await disconnect();
    logout();
  };

  if (!connected) {
    return (
      <Button
        onClick={() => setVisible(true)}
        variant="secondary"
        className={cn("font-medium", className)}
      >
        Connect Wallet
      </Button>
    );
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" className="font-mono outline-0 hover:border-none border-none hover:outline-0 hover:bg-border hover:cursor-pointer bg-border/80">
          {publicKey?.toBase58().slice(0, 4)}...{publicKey?.toBase58().slice(-6)}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56 bg-border">
        <DropdownMenuItem onClick={copyAddress} className='hover:bg-card/60 hover:cursor-pointer'>
          {publicKey?.toBase58().slice(0, 4)}...{publicKey?.toBase58().slice(-6)}
          <Copy className="mr-0 h-4 w-8" />
        </DropdownMenuItem>
        <DropdownMenuItem onClick={handleDisconnect} className='hover:bg-card/60 hover:cursor-pointer'>
          <span>Disconnect</span>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
