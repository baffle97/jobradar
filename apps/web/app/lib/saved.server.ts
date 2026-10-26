import { and, eq } from "drizzle-orm";
import { db, schema } from "~/db";
import type { SavedStatus } from "~/lib/ui/saved";

const s = schema.savedJobs;

// Save or move a job for one user; status null removes it.
export async function setSaved(userId: number, jobId: number, status: SavedStatus | null) {
  if (status === null) {
    await db
      .delete(s)
      .where(and(eq(s.userId, userId), eq(s.jobId, jobId)))
      .run();
    return;
  }
  const now = new Date().toISOString();
  await db
    .insert(s)
    .values({ userId, jobId, status, createdAt: now, updatedAt: now })
    .onConflictDoUpdate({ target: [s.userId, s.jobId], set: { status, updatedAt: now } })
    .run();
}

export async function savedStatus(userId: number, jobId: number): Promise<SavedStatus | null> {
  const row = await db
    .select({ status: s.status })
    .from(s)
    .where(and(eq(s.userId, userId), eq(s.jobId, jobId)))
    .get();
  return (row?.status as SavedStatus | undefined) ?? null;
}
