'use client';

import React, { ReactNode } from 'react';
import { WalletContextProvider } from '@/lib/wallet-context';

interface ProvidersProps {
    children: ReactNode;
}

export function Providers({ children }: ProvidersProps) {
    return (
        <WalletContextProvider>
            {children}
        </WalletContextProvider>
    );
}
