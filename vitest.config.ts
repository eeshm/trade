import { defineConfig } from "vitest/config";
import path from "node:path";

export default defineConfig({
  test: {
    include: ["tests/**/*.test.ts"],
    exclude: ["**/node_modules/**", "**/dist/**"],
    environment: "node",
    globals: true,
    globalSetup: ["./tests/setup/globalSetup.ts"],
    setupFiles: ["./tests/setup/testEnv.ts"],
    hookTimeout: 60000,
    testTimeout: 30000,
    reporters: ["default"],
    // Run tests sequentially to avoid DB/Redis conflicts
    pool: "forks",
    poolOptions: {
      forks: {
        singleFork: true,
      },
    },
    coverage: {
      provider: "v8",
      reportsDirectory: "coverage",
      exclude: ["tests/**", "**/node_modules/**"],
    },
  },
  resolve: {
    alias: {
      "@repo/db": path.resolve(__dirname, "packages/db/src/index.ts"),
      "@repo/redis": path.resolve(__dirname, "packages/redis/src/index.ts"),
      "@repo/auth": path.resolve(__dirname, "packages/auth/src/index.ts"),
      "@repo/trading": path.resolve(__dirname, "packages/trading/src/index.ts"),
      "@repo/pricing": path.resolve(__dirname, "packages/pricing/src/index.ts"),
      "@repo/events": path.resolve(__dirname, "packages/events/src/index.ts"),
      "@repo/env": path.resolve(__dirname, "packages/env/src/index.ts"),
    },
  },
});
