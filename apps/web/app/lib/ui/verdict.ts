import type { Verdict } from "~/lib/eligibility/types";
import { VERDICTS } from "~/lib/eligibility/types";

export type VerdictTone = "yes" | "no" | "unclear" | "none";

export function verdictTone(verdict: string | null | undefined): VerdictTone {
  if (verdict === "eligible") return "yes";
  if (verdict === "not_eligible") return "no";
  if (verdict === "unclear") return "unclear";
  return "none";
}

export function verdictStamp(verdict: string | null | undefined): string {
  switch (verdict) {
    case "eligible":
      return "India: Yes";
    case "not_eligible":
      return "India: No";
    case "unclear":
      return "India: Unclear";
    default:
      return "Not checked";
  }
}

export function verdictWord(verdict: string | null | undefined): string {
  switch (verdict) {
    case "eligible":
      return "Yes";
    case "not_eligible":
      return "No";
    case "unclear":
      return "Unclear";
    default:
      return "Not checked";
  }
}

// Stored reasons are sometimes about the pipeline, not the posting ("no LLM is
// configured", "LLM call failed: AI_APICallError ..."). Those stay in the DB;
// the UI shows a plain line instead.
const NOT_READ = "Not decided yet: the posting doesn't say where you can work from.";
const NOT_FINISHED = "Not decided yet: the check on this posting didn't finish.";

export function reasonForDisplay(reason: string | null): string | null {
  if (!reason) return reason;
  if (/no LLM is configured/i.test(reason)) return NOT_READ;
  if (/^LLM call failed/i.test(reason) || /^The model (said|returned)/i.test(reason)) {
    return NOT_FINISHED;
  }
  return reason;
}

export function parseVerdict(value: unknown): Verdict | null {
  return typeof value === "string" && (VERDICTS as readonly string[]).includes(value)
    ? (value as Verdict)
    : null;
}

// Feed filter (the `v` search param).
export const FEED_FILTERS = ["open", "eligible", "not_eligible", "all"] as const;
export type FeedFilter = (typeof FEED_FILTERS)[number];

export function parseFeedFilter(value: string | null): FeedFilter {
  return (FEED_FILTERS as readonly string[]).includes(value ?? "") ? (value as FeedFilter) : "open";
}
