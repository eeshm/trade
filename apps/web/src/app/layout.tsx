import { Geist, Geist_Mono } from 'next/font/google';
import './globals.css';
import { Providers } from './providers';
import { Toaster } from 'sonner';

const geistSans = Geist({
    variable: '--font-geist-sans',
    subsets: ['latin'],
});

const geistMono = Geist_Mono({
    variable: '--font-geist-mono',
    subsets: ['latin'],
});

export const metadata = {
    title: 'Solana Paper Trading',
    description: 'Real‑time paper trading on SOL/USD',
};

export default function RootLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    return (
        <html lang="en" className="bg-gray-50 dark:bg-primary">
            <body className={`${geistSans.variable} ${geistMono.variable} antialiased h-full flex flex-col`}>
                <Providers>
                    <main className="flex-1 container mx-auto p-4">
                        {children}
                    </main>
                    <Toaster position="top-right" />
                </Providers>
            </body>
        </html>
    );
}
