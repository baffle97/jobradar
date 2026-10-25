import type { Config } from "@react-router/dev/config";
import { vercelPreset } from "@vercel/react-router/vite";

export default {
  ssr: true,
  // The preset splits the server build per function config, which `pnpm start`
  // can't serve, so it only applies to builds running on Vercel.
  presets: process.env.VERCEL ? [vercelPreset()] : [],
} satisfies Config;
