// Sign-ups are closed: the login action signs existing accounts in and never
// creates one. Runs on a throwaway SQLite file with every migration applied.
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { count } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

const dir = mkdtempSync(path.join(tmpdir(), "jobradar-login-"));

vi.mock("~/db", async () => {
  const { createClient } = await import("@libsql/client");
  const { drizzle } = await import("drizzle-orm/libsql");
  const schema = await import("~/db/schema");
  const client = createClient({ url: `file:${path.join(dir, "test.db")}` });
  return { db: drizzle(client, { schema }), schema };
});

const { db, schema } = await import("~/db");
const { migrate } = await import("drizzle-orm/libsql/migrator");
const { createUser } = await import("~/lib/auth.server");
const { action } = await import("./login");

function login(email: string, password: string) {
  const body = new URLSearchParams({ email, password });
  return action({ request: new Request("http://localhost/login", { method: "POST", body }) });
}

const users = async () => (await db.select({ n: count() }).from(schema.users).all())[0].n;

beforeAll(async () => {
  await migrate(db, { migrationsFolder: path.resolve(__dirname, "../../drizzle") });
  await createUser("me@example.com", "correct horse battery");
});

afterAll(() => rmSync(dir, { recursive: true, force: true }));

describe("login action", () => {
  it("signs an existing account in", async () => {
    const res = await login("me@example.com", "correct horse battery");
    expect(res).toBeInstanceOf(Response);
    const r = res as Response;
    expect(r.status).toBe(302);
    expect(r.headers.get("Location")).toBe("/");
    expect(r.headers.get("Set-Cookie")).toMatch(/session=/);
  });

  it("refuses a wrong password", async () => {
    expect(await login("me@example.com", "wrong password here")).toEqual({
      error: "Invalid credentials.",
    });
  });

  it("refuses an unknown email with the same answer, and creates no account", async () => {
    const before = await users();
    expect(await login("stranger@example.com", "any password at all")).toEqual({
      error: "Invalid credentials.",
    });
    expect(await users()).toBe(before);
  });

  it("createUser refuses an email that already has an account", async () => {
    await expect(createUser("me@example.com", "another password")).rejects.toThrow(
      /already exists/,
    );
  });
});
