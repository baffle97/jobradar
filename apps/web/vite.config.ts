import path from "node:path";
import { reactRouter } from "@react-router/dev/vite";
import tailwindcss from "@tailwindcss/vite";
import { defineConfig } from "vite";

export default defineConfig({
  plugins: [tailwindcss(), reactRouter()],
  // react-aria's ESM files import CommonJS files by named export, which Node
  // rejects when the server loads them from node_modules (as on Vercel).
  // Bundling the HeroUI stack into the server build avoids that.
  ssr: {
    noExternal: [
      /^@heroui\//,
      /^@react-aria\//,
      /^@react-stately\//,
      /^@react-types\//,
      /^@internationalized\//,
      "react-aria",
      "react-aria-components",
      "react-stately",
    ],
  },
  resolve: {
    alias: {
      "~": path.resolve(__dirname, "./app"),
    },
  },
});
