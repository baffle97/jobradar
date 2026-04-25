import { and, eq, lt } from "drizzle-orm";
import { db, schema } from "~/db";

export async function cleanupStaleJobs(): Promise<{ deactivated: number }> {
  const cutoff = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();

  const result = db
    .update(schema.jobs)
    .set({ isActive: false })
    .where(and(eq(schema.jobs.isActive, true), lt(schema.jobs.createdAt, cutoff)))
    .run();

  console.log(`[cleanup] deactivated ${result.changes} stale jobs`);
  return { deactivated: result.changes };
}
