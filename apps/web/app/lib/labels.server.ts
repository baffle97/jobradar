// The user's hand labels (ground truth for the eligibility eval). One row per
// job; saving again overwrites the previous answer.
import { and, count, eq, isNotNull, isNull, or } from "drizzle-orm";
import { db, schema } from "~/db";
import type { Verdict } from "~/lib/eligibility/types";

export const LABEL_TARGET = 200;
const MAX_NOTE = 1000;

export async function saveLabel(jobId: number, label: Verdict, note: string | null) {
  const cleanNote = note?.trim().slice(0, MAX_NOTE) || null;
  const labelledAt = new Date().toISOString();
  await db
    .insert(schema.eligibilityLabels)
    .values({ jobId, label, note: cleanNote, labelledAt })
    .onConflictDoUpdate({
      target: schema.eligibilityLabels.jobId,
      set: { label, note: cleanNote, labelledAt },
    })
    .run();
}

export async function countLabels(): Promise<number> {
  const [row] = await db.select({ n: count() }).from(schema.eligibilityLabels).all();
  return row?.n ?? 0;
}

// Jobs the eligibility agent judges: active, and remote or with no stated work mode.
export const inScopeJobs = and(
  eq(schema.jobs.isActive, true),
  or(isNull(schema.jobs.workMode), eq(schema.jobs.workMode, "remote")),
);

export const checkedInScopeJobs = and(inScopeJobs, isNotNull(schema.jobs.eligibility));
