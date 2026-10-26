// SQL for the feed's filters, all on jobs columns. The params come
// from lib/ui/feed-params.ts (parsed and validated there).
import { inArray, type SQL, sql } from "drizzle-orm";
import * as schema from "~/db/schema";
import type { FeedParams } from "~/lib/ui/feed-params";
import { SOURCE_VALUES } from "~/lib/ui/feed-params";
import type { RoleKey } from "~/lib/ui/roles";

const j = schema.jobs;

// When the posting says it was published, else when we first saw it (julian days).
export const postedAtSql = sql`COALESCE(julianday(${j.postedAt}), julianday(${j.createdAt}))`;

// jobs.roles holds space-padded tags (" ai eng "), so one LIKE per filter. A
// row whose roles is still NULL matches no role; backfill:roles fills those.
export function roleCondition(role: RoleKey): SQL {
  return sql`${j.roles} LIKE ${`% ${role} %`}`;
}

// Every filter except the verdict segment (v) and basis, which the caller adds:
// the segment counts are computed under these.
export function narrowingConditions(p: FeedParams): SQL[] {
  const out: SQL[] = [];
  if (p.q) {
    const like = `%${p.q}%`;
    out.push(sql`(${j.title} LIKE ${like} OR ${j.company} LIKE ${like})`);
  }
  if (p.role) out.push(roleCondition(p.role));
  if (p.age) out.push(sql`${postedAtSql} >= julianday('now') - ${p.age}`);
  if (p.src) out.push(inArray(j.source, SOURCE_VALUES[p.src]));
  if (p.pay) {
    out.push(
      sql`(${j.salaryMin} IS NOT NULL OR ${j.salaryMax} IS NOT NULL OR NULLIF(trim(${j.salaryText}), '') IS NOT NULL)`,
    );
  }
  return out;
}

// basis=explicit hides decided verdicts that rest only on weak hints.
export const notFromHints = sql`(${j.eligibilityBasis} IS NULL OR ${j.eligibilityBasis} <> 'hints')`;
