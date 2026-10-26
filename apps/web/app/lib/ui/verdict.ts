import type { Hint, Verdict } from "~/lib/eligibility/types";
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
  if (/^LLM call failed/i.test(reason) || /^The model(?:'s hints| said| returned)/i.test(reason)) {
    return NOT_FINISHED;
  }
  return reason;
}

// "India: Yes · from hints": shown only when weak hints decided it (elig-v0.4).
export function basisTag(
  verdict: string | null | undefined,
  basis: string | null | undefined,
): string | null {
  return basis === "hints" && (verdict === "eligible" || verdict === "not_eligible")
    ? "from hints"
    : null;
}

function isHint(h: unknown): h is Hint {
  const x = h as Partial<Hint> | null;
  return (
    typeof x?.quote === "string" &&
    typeof x.section === "string" &&
    (x.points === "india_ok" || x.points === "india_blocked")
  );
}

// Models name sections after the posting's own headings ("What you'll get:
// Benefits and Perks"). Display only: lowercase, at most 24 characters.
const MAX_SECTION = 24;

export function sectionLabel(section: string): string {
  const s = section.replace(/\s+/g, " ").trim().toLowerCase() || "posting";
  return s.length > MAX_SECTION ? `${s.slice(0, MAX_SECTION - 1).trimEnd()}…` : s;
}

// The job page lists hints in two groups, strong ones first and otherwise in
// the model's order. Rows from before v0.4 have no hints (null).
export function groupHints(hints: Hint[] | null | undefined): { yes: Hint[]; no: Hint[] } {
  const valid = Array.isArray(hints) ? hints.filter(isHint) : [];
  const ordered = [
    ...valid.filter((h) => h.strength === "strong"),
    ...valid.filter((h) => h.strength !== "strong"),
  ];
  return {
    yes: ordered.filter((h) => h.points === "india_ok"),
    no: ordered.filter((h) => h.points === "india_blocked"),
  };
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
