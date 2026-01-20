import { defineConfig } from "vitest/config";
import path from "node:path";

/**
 * Vitest configuration for frontend (web) tests
 * Uses jsdom environment for React/browser testing
 * 
 * Note: For store tests, we don't need the React plugin.
 * Add it later when testing React components.
 */
export default defineConfig({
  test: {
    include: ["tests/web/**/*.test.ts", "tests/web/**/*.test.tsx"],
    exclude: ["**/node_modules/**", "**/dist/**"],
    environment: "jsdom",
    globals: true,
    setupFiles: ["./tests/web/setup.ts"],
    hookTimeout: 30000,
    testTimeout: 10000,
    reporters: ["default"],
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "apps/web/src"),
      "@/types": path.resolve(__dirname, "apps/web/src/types"),
      "@/store": path.resolve(__dirname, "apps/web/src/store"),
      "@/hooks": path.resolve(__dirname, "apps/web/src/hooks"),
      "@/lib": path.resolve(__dirname, "apps/web/src/lib"),
      "@/components": path.resolve(__dirname, "apps/web/src/components"),
    },
  },
});
