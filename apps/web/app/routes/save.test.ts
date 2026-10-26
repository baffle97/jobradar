// POST /save keeps one row per user and job, scoped to the signed-in user, and
// the feed's pay filter matches what the cards print. Runs on a throwaway
// SQLite file with every migration applied.
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { and, eq } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

const dir = mkdtempSync(path.join(tmpdir(), "jobradar-save-"));

vi.mock("~/db", async () => {
  const { createClient } = await import("@libsql/client");
  const { drizzle } = await import("drizzle-orm/libsql");
  const schema = await import("~/db/schema");
  const client = createClient({ url: `file:${path.join(dir, "test.db")}` });
  return { db: drizzle(client, { schema }), schema };
});

const { db, schema } = await import("~/db");
const { migrate } = await import("drizzle-orm/libsql/migrator");
const { createSession, createUser } = await import("~/lib/auth.server");
const { minPayCondition } = await import("~/lib/feed.server");
const { inrPerMonth } = await import("~/lib/ui/pay");
const { action } = await import("./save");

let me: number;
let other: number;
let cookie: string;
let jobId: number;

function post(fields: Record<string, string>, withCookie = true) {
  const request = new Request("http://localhost/save", {
    method: "POST",
    body: new URLSearchParams(fields),
    headers: withCookie ? { Cookie: cookie } : {},
  });
  return action({ request, params: {}, context: {} } as Parameters<typeof action>[0]);
}

async function rows(userId: number) {
  return db
    .select()
    .from(schema.savedJobs)
    .where(and(eq(schema.savedJobs.userId, userId), eq(schema.savedJobs.jobId, jobId)))
    .all();
}

beforeAll(async () => {
  await migrate(db, { migrationsFolder: path.resolve(__dirname, "../../drizzle") });
  me = await createUser("me@example.com", "correct horse battery");
  other = await createUser("other@example.com", "correct horse battery");
  cookie = `session=${await createSession(me)}`;
  const job = await db
    .insert(schema.jobs)
    .values({ title: "Agent Engineer", company: "Acme", source: "ashby" })
    .returning()
    .get();
  jobId = job.id;
});

afterAll(() => rmSync(dir, { recursive: true, force: true }));

describe("save action", () => {
  it("saves, then moves the same row along the pipeline", async () => {
    expect(await post({ jobId: String(jobId), status: "saved", js: "1" })).toEqual({
      ok: true,
      jobId,
      status: "saved",
    });
    await post({ jobId: String(jobId), status: "applied", js: "1" });
    const saved = await rows(me);
    expect(saved).toHaveLength(1);
    expect(saved[0].status).toBe("applied");
    expect(await rows(other)).toHaveLength(0);
  });

  it("without JS, sends the browser back where it came from (same-site only)", async () => {
    const res = (await post({
      jobId: String(jobId),
      status: "interviewing",
      returnTo: "/?role=ai#job-1",
    }).catch((e) => e)) as Response;
    expect(res.status).toBe(302);
    expect(res.headers.get("Location")).toBe("/?role=ai#job-1");
    const away = (await post({
      jobId: String(jobId),
      status: "interviewing",
      returnTo: "//evil.example",
    }).catch((e) => e)) as Response;
    expect(away.headers.get("Location")).toBe("/");
  });

  it("remove deletes the row", async () => {
    await post({ jobId: String(jobId), status: "remove", js: "1" });
    expect(await rows(me)).toHaveLength(0);
  });

  it("refuses a bad status, an unknown job, and a request with no session", async () => {
    const bad = await post({ jobId: String(jobId), status: "hired", js: "1" });
    expect((bad as { init: ResponseInit }).init?.status).toBe(400);
    const missing = await post({ jobId: "999999", status: "saved", js: "1" });
    expect((missing as { init: ResponseInit }).init?.status).toBe(404);
    const anon = (await post({ jobId: String(jobId), status: "saved" }, false).catch(
      (e) => e,
    )) as Response;
    expect(anon.headers.get("Location")).toBe("/login");
  });
});

describe("minPayCondition", () => {
  const cases = [
    { title: "USD yearly", salaryMin: 40_000, salaryMax: 60_000, salaryCurrency: "USD" },
    { title: "USD hourly", salaryMin: 20, salaryMax: 20, salaryCurrency: "USD" },
    { title: "INR yearly", salaryMin: null, salaryMax: 4_800_000, salaryCurrency: "INR" },
    { title: "EUR low", salaryMin: 20_000, salaryMax: 30_000, salaryCurrency: "eur" },
    { title: "no currency", salaryMin: 90_000, salaryMax: 120_000, salaryCurrency: null },
    { title: "no figure", salaryMin: null, salaryMax: null, salaryCurrency: "USD" },
  ];

  it("keeps exactly the jobs whose ₹/month on the card clears the bar", async () => {
    for (const c of cases) {
      await db
        .insert(schema.jobs)
        .values({ ...c, company: "Pay Co", source: "ashby" })
        .run();
    }
    for (const lakh of [2, 3, 4, 6] as const) {
      const got = await db
        .select({ title: schema.jobs.title })
        .from(schema.jobs)
        .where(and(eq(schema.jobs.company, "Pay Co"), minPayCondition(lakh)))
        .all();
      const want = cases.filter(
        (c) => (inrPerMonth({ ...c, salaryText: null }) ?? 0) >= lakh * 100_000,
      );
      expect(got.map((r) => r.title).sort()).toEqual(want.map((c) => c.title).sort());
    }
  });
});
