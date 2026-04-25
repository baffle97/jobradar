import { sql } from "drizzle-orm";
import { db, schema } from "~/db";

type JobInsert = typeof schema.jobs.$inferInsert;

export function upsertJobs(jobRows: JobInsert[]): { inserted: number; total: number } {
  let inserted = 0;

  for (const row of jobRows) {
    const result = db
      .insert(schema.jobs)
      .values(row)
      .onConflictDoNothing({ target: schema.jobs.dedupHash })
      .run();

    if (result.changes > 0) {
      inserted++;
    }
  }

  return { inserted, total: jobRows.length };
}
