// SQL for the feed's filters, all on jobs columns. The params come
// from lib/ui/feed-params.ts (parsed and validated there).
import { inArray, type SQL, sql } from "drizzle-orm";
import * as schema from "~/db/schema";
import type { FeedParams } from "~/lib/ui/feed-params";
import { SOURCE_VALUES } from "~/lib/ui/feed-params";
import { HOURS_PER_YEAR, INR_PER, LAKH, type MinPay } from "~/lib/ui/pay";
import type { RoleKey } from "~/lib/ui/roles";

const j = schema.jobs;

// When the posting says it was published, else when we first saw it (julian days).
export const postedAtSql = sql`COALESCE(julianday(${j.postedAt}), julianday(${j.createdAt}))`;

// jobs.roles holds space-padded tags (" ai eng "), so one LIKE per filter. A
// row whose roles is still NULL matches no role; backfill:roles fills those.
export function roleCondition(role: RoleKey): SQL {
  return sql`${j.roles} LIKE ${`% ${role} %`}`;
}

// The top of the posted range in rupees a year (inrPerMonth in lib/ui/pay.ts,
// times 12). One flat CASE, not a chain of ORs: Turso caps expression depth at 100.
const top = sql`COALESCE(${j.salaryMax}, ${j.salaryMin})`;
const annualTop = sql`(CASE WHEN ${top} < 1000 THEN ${top} * ${HOURS_PER_YEAR} ELSE ${top} END)`;
const inrRate = sql`(CASE upper(${j.salaryCurrency}) ${sql.join(
  Object.entries(INR_PER).map(([code, rate]) => sql`WHEN ${code} THEN ${rate}`),
  sql` `,
)} END)`;

export function minPayCondition(lakh: MinPay): SQL {
  return sql`${annualTop} * ${inrRate} >= ${lakh * LAKH * 12}`;
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
  if (p.min) out.push(minPayCondition(p.min));
  return out;
}

// basis=explicit hides decided verdicts that rest only on weak hints.
export const notFromHints = sql`(${j.eligibilityBasis} IS NULL OR ${j.eligibilityBasis} <> 'hints')`;
