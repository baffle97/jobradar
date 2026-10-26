// jobs.roles holds the title's role tags (lib/ui/roles.ts). Scrapers write it
// with the title; this fills rows that have none yet (rows from before the
// column, or a writer that missed it). Idempotent: only touches roles IS NULL.
import { eq, isNull } from "drizzle-orm";
import { db, schema } from "~/db";
import { roleTags } from "~/lib/ui/roles";

const DEFAULT_BATCH = 500;
const DEFAULT_MAX_ROWS = 50_000;

function intOr(value: unknown, fallback: number): number {
  const n = Number(value);
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : fallback;
}

// Task "backfill:roles"; payload { batchSize?, maxRows? }.
export async function fillMissingRoles(payload?: unknown): Promise<{ filled: number }> {
  const opts = (payload ?? {}) as { batchSize?: unknown; maxRows?: unknown };
  const batchSize = intOr(opts.batchSize, DEFAULT_BATCH);
  const maxRows = intOr(opts.maxRows, DEFAULT_MAX_ROWS);
  const j = schema.jobs;

  let filled = 0;
  while (filled < maxRows) {
    const rows = await db
      .select({ id: j.id, title: j.title })
      .from(j)
      .where(isNull(j.roles))
      .limit(Math.min(batchSize, maxRows - filled))
      .all();
    if (rows.length === 0) break;
    // One batch per round trip, like the scrapers' upserts.
    const [first, ...rest] = rows.map((r) =>
      db
        .update(j)
        .set({ roles: roleTags(r.title) })
        .where(eq(j.id, r.id)),
    );
    await db.batch([first, ...rest]);
    filled += rows.length;
  }

  console.log(`[roles] filled ${filled} jobs`);
  return { filled };
}
