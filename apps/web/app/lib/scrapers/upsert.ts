import { sql } from "drizzle-orm";
import { db, schema } from "~/db";

type JobInsert = typeof schema.jobs.$inferInsert;

const BATCH_SIZE = 100;

export async function upsertJobs(
  jobRows: JobInsert[],
): Promise<{ inserted: number; total: number }> {
  let inserted = 0;

  // Batched so a scrape costs a few round trips to Turso instead of one per row.
  for (let i = 0; i < jobRows.length; i += BATCH_SIZE) {
    const [first, ...rest] = jobRows
      .slice(i, i + BATCH_SIZE)
      .map((row) =>
        db.insert(schema.jobs).values(row).onConflictDoNothing({ target: schema.jobs.dedupHash }),
      );
    const results = await db.batch([first, ...rest]);
    for (const result of results) {
      if (result.rowsAffected > 0) inserted++;
    }
  }

  return { inserted, total: jobRows.length };
}
