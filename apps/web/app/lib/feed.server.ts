// SQL for the feed's filters, all on existing jobs columns. The params come
// from lib/ui/feed-params.ts (parsed and validated there).
import { inArray, type SQL, sql } from "drizzle-orm";
import * as schema from "~/db/schema";
import type { FeedParams } from "~/lib/ui/feed-params";
import { SOURCE_VALUES } from "~/lib/ui/feed-params";
import { type RoleKey, roleTerms, TITLE_PUNCTUATION } from "~/lib/ui/roles";

const j = schema.jobs;

// When the posting says it was published, else when we first saw it (julian days).
export const postedAtSql = sql`COALESCE(julianday(${j.postedAt}), julianday(${j.createdAt}))`;

// The normalized title of roles.ts in SQL: " " + lower(title) + " " with every
// TITLE_PUNCTUATION character replaced by a space. Constant text only, so it is
// inlined; the LIKE patterns go in as parameters. The replaces are split over
// nested subqueries, a few per level: 26 nested replace() calls overflow
// SQLite's parser stack.
const REPLACES_PER_LEVEL = 6;
const NORMALIZED_TITLES = (() => {
  let query = `SELECT "id" AS id, (' ' || lower("title") || ' ') AS t FROM "jobs"`;
  for (let i = 0; i < TITLE_PUNCTUATION.length; i += REPLACES_PER_LEVEL) {
    const expr = TITLE_PUNCTUATION.slice(i, i + REPLACES_PER_LEVEL).reduce(
      (e, ch) => `replace(${e}, '${ch.replace(/'/g, "''")}', ' ')`,
      "t",
    );
    query = `SELECT id, ${expr} AS t FROM (${query})`;
  }
  // LIMIT -1 (no limit) keeps SQLite from flattening the subquery into the
  // WHERE, which would redo every replace() for every LIKE term.
  return `${query} LIMIT -1`;
})();

// The title is normalized once per row, then matched against every term.
export function roleCondition(role: RoleKey): SQL {
  const terms = roleTerms(role === "nontech" ? "eng" : role);
  const like = (word: string) => sql`t LIKE ${`%${word}%`}`;
  const anyTerm = sql.join(
    terms.map((term) =>
      typeof term === "string"
        ? like(term)
        : sql`(${like(term.term)} AND (${sql.join(term.with.map(like), sql` OR `)}))`,
    ),
    sql` OR `,
  );
  const ids = sql`SELECT id FROM (${sql.raw(NORMALIZED_TITLES)}) WHERE ${anyTerm}`;
  return role === "nontech" ? sql`${j.id} NOT IN (${ids})` : sql`${j.id} IN (${ids})`;
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
