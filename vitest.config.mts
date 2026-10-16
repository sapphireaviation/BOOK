import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

// Resolves the "@/..." import alias from tsconfig.json in tests.
export default defineConfig({
  resolve: {
    alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) },
  },
});
