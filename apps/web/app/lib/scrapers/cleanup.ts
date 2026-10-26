import { and, eq, sql } from "drizzle-orm";
import { db, schema } from "~/db";
import { fillMissingRoles } from "./roles";

export async function cleanupStaleJobs(): Promise<{ deactivated: number; rolesFilled: number }> {
  const cutoff = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();

  // ATS jobs refresh last_seen_at on every poll, so only rows nobody has seen
  // for 30 days are retired here; closed ATS postings are handled at poll time.
  const result = await db
    .update(schema.jobs)
    .set({ isActive: false })
    .where(
      and(
        eq(schema.jobs.isActive, true),
        sql`coalesce(${schema.jobs.lastSeenAt}, ${schema.jobs.createdAt}) < ${cutoff}`,
      ),
    )
    .run();

  console.log(`[cleanup] deactivated ${result.rowsAffected} stale jobs`);
  // Daily, so a job without role tags never lingers.
  const roles = await fillMissingRoles();
  return { deactivated: result.rowsAffected, rolesFilled: roles.filled };
}
