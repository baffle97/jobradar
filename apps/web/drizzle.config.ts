import path from "node:path";
import { defineConfig } from "drizzle-kit";

// Same fallback as app/db: Turso when TURSO_DATABASE_URL is set, else the local file.
// `pnpm db:migrate:turso` loads the repo-root .env.local to target Turso.
export default defineConfig({
  schema: "./app/db/schema.ts",
  out: "./drizzle",
  dialect: "turso",
  dbCredentials: {
    url: process.env.TURSO_DATABASE_URL || `file:${path.resolve("data", "jobradar.db")}`,
    authToken: process.env.TURSO_AUTH_TOKEN,
  },
});
