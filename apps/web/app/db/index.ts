import path from "node:path";
import { createClient } from "@libsql/client";
import { drizzle } from "drizzle-orm/libsql";
import * as schema from "./schema";

// Turso in production; the local SQLite file when TURSO_DATABASE_URL is unset.
const localDbUrl = `file:${path.resolve(process.cwd(), "data", "jobradar.db")}`;

const url = process.env.TURSO_DATABASE_URL || localDbUrl;

// Vercel's filesystem is read-only, so falling back to a file there would only fail later.
if (process.env.VERCEL && url === localDbUrl) {
  throw new Error("TURSO_DATABASE_URL must be set on Vercel");
}

const client = createClient({ url, authToken: process.env.TURSO_AUTH_TOKEN });

export const db = drizzle(client, { schema });
export { schema };
