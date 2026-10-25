import path from "node:path";
import { defineConfig } from "vitest/config";

// Separate from vite.config.ts so tests don't boot the React Router plugin.
export default defineConfig({
  resolve: {
    alias: {
      "~": path.resolve(__dirname, "./app"),
    },
  },
  test: {
    include: ["app/**/*.test.ts"],
  },
});
