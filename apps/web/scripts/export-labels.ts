// pnpm labels:export -> evals/eligibility-labels.jsonl, so hand labels can live in git.
import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { asc, eq } from "drizzle-orm";
import { db, schema } from "~/db";
import { postingFromJob, postingHash } from "~/lib/eligibility/job";

const out = path.resolve(import.meta.dirname, "../evals/eligibility-labels.jsonl");

const rows = await db
  .select({ label: schema.eligibilityLabels, job: schema.jobs })
  .from(schema.eligibilityLabels)
  .innerJoin(schema.jobs, eq(schema.jobs.id, schema.eligibilityLabels.jobId))
  .orderBy(asc(schema.eligibilityLabels.jobId))
  .all();

const lines = rows.map(({ label, job }) =>
  JSON.stringify({
    jobId: job.id,
    title: job.title,
    company: job.company,
    label: label.label,
    note: label.note,
    labelledAt: label.labelledAt,
    postingHash: postingHash(postingFromJob(job)),
  }),
);

mkdirSync(path.dirname(out), { recursive: true });
writeFileSync(out, lines.length ? `${lines.join("\n")}\n` : "");
console.log(`wrote ${lines.length} labels to ${path.relative(process.cwd(), out)}`);
