// jobs.roles end to end on a throwaway SQLite file with every migration applied
// (not the app's database): writers store the tags, the backfill fills the
// gaps, and the feed's roleCondition matches the stored tags.
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { asc, isNull, sql } from "drizzle-orm";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

const dir = mkdtempSync(path.join(tmpdir(), "jobradar-roles-"));

vi.mock("~/db", async () => {
  const { createClient } = await import("@libsql/client");
  const { drizzle } = await import("drizzle-orm/libsql");
  const schema = await import("~/db/schema");
  const client = createClient({ url: `file:${path.join(dir, "test.db")}` });
  return { db: drizzle(client, { schema }), schema };
});

const { db, schema } = await import("~/db");
const { migrate } = await import("drizzle-orm/libsql/migrator");
const { upsertJobs } = await import("./upsert");
const { fillMissingRoles } = await import("./roles");
const { cleanupStaleJobs } = await import("./cleanup");
const { roleCondition } = await import("~/lib/feed.server");
const { roleTags } = await import("~/lib/ui/roles");

const j = schema.jobs;
const job = (title: string, i: number) => ({
  title,
  company: "Acme",
  source: "hn",
  dedupHash: `h-${title}-${i}`,
});
const rolesByTitle = async () =>
  Object.fromEntries(
    (await db.select({ title: j.title, roles: j.roles }).from(j).orderBy(asc(j.id)).all()).map(
      (r) => [r.title, r.roles],
    ),
  );

beforeAll(async () => {
  await migrate(db, { migrationsFolder: path.resolve(__dirname, "../../../drizzle") });
});
afterAll(() => rmSync(dir, { recursive: true, force: true }));
beforeEach(async () => {
  await db.delete(j).run();
});

describe("roleTags", () => {
  it("space-pads the groups so one tag can be matched with LIKE", () => {
    expect(roleTags("Software Engineer, Agents")).toBe(" ai eng ");
    expect(roleTags("Support Agent")).toBe(" nontech ");
  });
});

describe("upsertJobs", () => {
  it("stores the title's role tags with every new job", async () => {
    await upsertJobs([job("Senior iOS Engineer", 1), job("Support Agent", 2), job("Staff SRE", 3)]);
    expect(await rolesByTitle()).toEqual({
      "Senior iOS Engineer": " mobile eng ",
      "Support Agent": " nontech ",
      "Staff SRE": " infra eng ",
    });
  });
});

describe("fillMissingRoles (backfill:roles)", () => {
  it("fills only rows without tags, in batches, and is idempotent", async () => {
    await upsertJobs([job("Data Engineer", 1)]);
    for (const [i, title] of [
      "AI Engineer",
      "Head of People",
      "Cloud Sales",
      "Backend Developer",
    ].entries()) {
      await db
        .insert(j)
        .values(job(title, 10 + i))
        .run(); // no roles, like rows from before 0004
    }
    // A stored value is left alone even if it is not what roleTags would say.
    await db.update(j).set({ roles: " data " }).where(sql`${j.title} = 'Data Engineer'`).run();

    expect(await fillMissingRoles({ batchSize: 3 })).toEqual({ filled: 4 });
    expect(await rolesByTitle()).toEqual({
      "Data Engineer": " data ",
      "AI Engineer": " ai eng ",
      "Head of People": " nontech ",
      "Cloud Sales": " nontech ",
      "Backend Developer": " backend eng ",
    });
    expect(await fillMissingRoles()).toEqual({ filled: 0 });
  });

  it("maxRows caps one run", async () => {
    for (let i = 0; i < 5; i++) await db.insert(j).values(job("Engineer", i)).run();
    expect(await fillMissingRoles({ batchSize: 2, maxRows: 3 })).toEqual({ filled: 3 });
    expect(await db.select().from(j).where(isNull(j.roles)).all()).toHaveLength(2);
  });

  it("cleanup:stale-jobs fills them too", async () => {
    await db.insert(j).values(job("Android Developer", 1)).run();
    const r = await cleanupStaleJobs();
    expect(r.rolesFilled).toBe(1);
    expect(await rolesByTitle()).toEqual({ "Android Developer": " mobile eng " });
  });
});

describe("roleCondition", () => {
  it("matches the stored tag, whole tags only; NULL roles match nothing", async () => {
    await upsertJobs([
      job("Software Engineer, Agents", 1),
      job("Email Marketing Manager", 2),
      job("API Platform Engineer", 3),
    ]);
    await db.insert(j).values(job("ML Engineer (not tagged yet)", 4)).run();
    const titles = async (key: Parameters<typeof roleCondition>[0]) =>
      (
        await db.select({ t: j.title }).from(j).where(roleCondition(key)).orderBy(asc(j.id)).all()
      ).map((r) => r.t);
    expect(await titles("ai")).toEqual(["Software Engineer, Agents"]);
    expect(await titles("eng")).toEqual(["Software Engineer, Agents", "API Platform Engineer"]);
    expect(await titles("backend")).toEqual(["API Platform Engineer"]);
    expect(await titles("infra")).toEqual(["API Platform Engineer"]);
    expect(await titles("nontech")).toEqual(["Email Marketing Manager"]);
    expect(await titles("data")).toEqual([]);
  });
});
