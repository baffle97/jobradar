// The Role filter's SQL must agree with rolesForTitle (the tested JS table) on
// the same titles. Runs on an in-memory SQLite, not the app's database.
import { createClient } from "@libsql/client";
import { asc } from "drizzle-orm";
import { drizzle } from "drizzle-orm/libsql";
import { beforeAll, describe, expect, it } from "vitest";
import * as schema from "~/db/schema";
import { roleCondition } from "./feed.server";
import { ROLE_KEYS, rolesForTitle } from "./ui/roles";

const TITLES = [
  "Software Engineer, Agents",
  "Email Marketing Manager",
  "Senior iOS Engineer",
  "Maintenance Technician",
  "Staff SRE",
  "AI/ML Engineer (Remote)",
  "API Platform Engineer",
  "Rapid Response Coordinator",
  "Front-end Engineer (React)",
  "Full-Stack Developer",
  "Product Analyst",
  "HTML Email Designer",
  "Head of People",
  "O'Reilly Cloud Sales",
  "GenAI Solutions Architect",
  "Back-End Developer (Go) – LATAM",
  "Sr. Director of Agents Growth",
  "Support Agent",
  "Agentic Systems Engineer",
  "Cloud Sales Executive",
  "Platform Marketing Manager",
  "Cloud Infrastructure Engineer",
  "Platform Developer",
];

const client = createClient({ url: ":memory:" });
const db = drizzle(client, { schema });

beforeAll(async () => {
  await client.execute("CREATE TABLE jobs (id integer primary key, title text not null)");
  for (const [i, title] of TITLES.entries()) {
    await client.execute({
      sql: "INSERT INTO jobs (id, title) VALUES (?, ?)",
      args: [i + 1, title],
    });
  }
});

describe("roleCondition", () => {
  it.each(ROLE_KEYS.map((k) => [k]))("%s matches the same titles as rolesForTitle", async (key) => {
    const rows = await db
      .select({ title: schema.jobs.title })
      .from(schema.jobs)
      .where(roleCondition(key))
      .orderBy(asc(schema.jobs.id))
      .all();
    expect(rows.map((r) => r.title)).toEqual(TITLES.filter((t) => rolesForTitle(t).includes(key)));
  });
});
