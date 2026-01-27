import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Standalone output for Docker deployment
  output: 'standalone',

  // Turbopack config (Next.js 16+ default bundler)
  turbopack: {
    resolveAlias: {
      // Ignore mobile wallet adapter packages that aren't needed for web
      '@solana-mobile/mobile-wallet-adapter-protocol': './src/lib/empty-stub.js',
      '@solana-mobile/mobile-wallet-adapter-protocol-web3js': './src/lib/empty-stub.js',
      '@solana-mobile/wallet-adapter-mobile': './src/lib/empty-stub.js',
      '@solana-mobile/wallet-standard-mobile': './src/lib/empty-stub.js',
      '@react-native-async-storage/async-storage': './src/lib/empty-stub.js',
    },
  },

  // Webpack config (fallback when using --webpack flag)
  webpack: (config, { isServer }) => {
    // Ignore mobile wallet adapter packages that aren't needed for web
    config.resolve.alias = {
      ...config.resolve.alias,
      '@solana-mobile/mobile-wallet-adapter-protocol': false,
      '@solana-mobile/mobile-wallet-adapter-protocol-web3js': false,
      '@solana-mobile/wallet-adapter-mobile': false,
      '@solana-mobile/wallet-standard-mobile': false,
      '@react-native-async-storage/async-storage': false,
    };

    // Fallbacks for Node.js modules in browser
    if (!isServer) {
      config.resolve.fallback = {
        ...config.resolve.fallback,
        crypto: require.resolve('crypto-browserify'),
        stream: require.resolve('stream-browserify'),
        path: require.resolve('path-browserify'),
      };
    }

    return config;
  },
};

export default nextConfig;
