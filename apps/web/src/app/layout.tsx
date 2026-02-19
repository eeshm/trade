import { Geist, Geist_Mono } from 'next/font/google';
import './globals.css';
import { Providers } from './providers';
import { Toaster } from 'sonner';
import { Analytics } from "@vercel/analytics/next"

const geistSans = Geist({
    variable: '--font-geist-sans',
    subsets: ['latin'],
});

const geistMono = Geist_Mono({
    variable: '--font-geist-mono',
    subsets: ['latin'],
});

export const metadata = {
    title: 'paper.fun',
    description: 'Paper trading for Solana - practice with zero risk',
    icons: {
        icon: '/Logo.svg?v=1',
        shortcut: '/Logo.svg?v=1',
        apple: '/Logo.svg?v=1',
    },
};

export default function RootLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    return (
        <html lang="en" className="bg-gray-50 dark:bg-background">
            <body className={`${geistSans.variable} ${geistMono.variable} antialiased h-full flex flex-col`}>
                <Providers>
                    <Analytics />
                    <main className="flex-1 px-1">
                        {children}
                    </main>
                    <Toaster position="bottom-right" />
                </Providers>
            </body>
        </html>
    );
}
