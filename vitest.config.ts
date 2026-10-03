import { defineConfig } from "vitest/config";
import { fileURLToPath } from "node:url";

// Vitest config: resolve the "@/..." path alias (mirrors tsconfig paths) and run
// unit tests in a node environment.
export default defineConfig({
  resolve: {
    alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) },
  },
  test: {
    environment: "node",
    include: ["src/**/*.{test,spec}.{ts,tsx}"],
  },
});
