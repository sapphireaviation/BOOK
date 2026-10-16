import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

// Resolves the "@/..." import alias from tsconfig.json in tests.
export default defineConfig({
  test: {
    include: ["src/**/*.test.{ts,tsx}", "scripts/**/*.test.ts"],
    exclude: ["node_modules", ".claude/**", ".agents/**"],
  },
  resolve: {
    alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) },
  },
});
