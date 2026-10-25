// Turning a stored job row into the agent's Posting, and hashing that input so
// unchanged postings are not re-checked.
import { createHash } from "node:crypto";
import type { Posting } from "./types";

// Long descriptions are mostly benefits boilerplate; this caps LLM cost per posting.
export const MAX_DESCRIPTION_CHARS = 12_000;

export interface JobLike {
  title: string;
  company: string;
  location: string | null;
  locations: string[] | null;
  workMode: string | null;
  description: string | null;
}

export function postingFromJob(job: JobLike): Posting {
  const locations = job.locations?.length ? job.locations : job.location ? [job.location] : [];
  return {
    title: job.title,
    company: job.company,
    locations,
    workMode: job.workMode ?? null,
    description: (job.description ?? "").slice(0, MAX_DESCRIPTION_CHARS),
  };
}

export function postingHash(posting: Posting): string {
  const input = JSON.stringify([
    posting.title,
    posting.company,
    posting.locations,
    posting.workMode,
    posting.description,
  ]);
  return createHash("sha256").update(input).digest("hex").slice(0, 32);
}
