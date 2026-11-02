import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import path from "path";

// Frontend + shared-protocol tests. The backend has its own suite (server/vitest.config.ts)
// and contracts run under Hardhat.
export default defineConfig({
  plugins: [react()],
  test: {
    environment: "jsdom",
    globals: true,
    include: ["tests/**/*.test.{ts,tsx}"],
    exclude: ["**/node_modules/**", "server/**", "contracts/**", "**/dist/**"],
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
      "@shared": path.resolve(__dirname, "./shared"),
    },
  },
});
