import type { Hint } from "~/lib/eligibility/types";
import { normalizeText } from "~/lib/eligibility/verify";
import { findQuoteRange, type Mark, type Range } from "./highlight";

export type EvidencePlace =
  | { field: "description"; range: Range }
  | { field: "title"; range: Range }
  | { field: "location"; index: number; range: Range };

// Which field of the posting the evidence quote came from, and where in it.
// A quote that IS one of the locations ("India") is marked there. Otherwise the
// short fields (title, then locations) come before the description, and a
// whole-word match anywhere beats a match inside a word ("US" in "businesses").
// `wholeWord` skips that last fallback.
export function locateEvidence(
  evidence: string | null,
  posting: { title: string; locations: string[]; description: string },
  opts: { wholeWord?: boolean } = {},
): EvidencePlace | null {
  if (!evidence) return null;
  const q = normalizeText(evidence);
  if (!q) return null;
  const exact = posting.locations.findIndex((loc) => normalizeText(loc) === q);
  if (exact >= 0) {
    const range = findQuoteRange(posting.locations[exact], evidence);
    if (range) return { field: "location", index: exact, range };
  }
  for (const wholeWord of opts.wholeWord ? [true] : [true, false]) {
    const inTitle = findQuoteRange(posting.title, evidence, { wholeWord });
    if (inTitle) return { field: "title", range: inTitle };
    for (let index = 0; index < posting.locations.length; index++) {
      const range = findQuoteRange(posting.locations[index], evidence, { wholeWord });
      if (range) return { field: "location", index, range };
    }
    const inDescription = findQuoteRange(posting.description, evidence, { wholeWord });
    if (inDescription) return { field: "description", range: inDescription };
  }
  return null;
}

type PostingFields = { title: string; locations: string[]; description: string };

// Like locateEvidence, but a quote joined from several locations ("APJ | EMEA")
// that is not found whole is located part by part.
export function locateQuoteParts(
  quote: string | null,
  posting: PostingFields,
  opts: { wholeWord?: boolean } = {},
): EvidencePlace[] {
  const whole = locateEvidence(quote, posting, opts);
  if (whole) return [whole];
  if (!quote?.includes(" | ")) return [];
  return quote
    .split(" | ")
    .map((part) => locateEvidence(part, posting, opts))
    .filter((place): place is EvidencePlace => place !== null);
}

export interface PostingMarks {
  title: Mark[];
  locations: Mark[][];
  description: Mark[];
}

// Every place to mark in the posting: the main evidence (located as above) and
// each hint quote, whole words only; a joined quote marks each part. A hint that
// overlaps an earlier mark in the same field (often the main evidence) is left out.
export function locateMarks(
  evidence: string | null,
  hints: Hint[],
  posting: PostingFields,
): PostingMarks {
  const marks: PostingMarks = {
    title: [],
    locations: posting.locations.map(() => []),
    description: [],
  };
  const add = (place: EvidencePlace, kind: Mark["kind"]) => {
    const list = place.field === "location" ? marks.locations[place.index] : marks[place.field];
    const { start, end } = place.range;
    if (list.some((m) => start < m.end && m.start < end)) return;
    list.push({ start, end, kind });
  };
  for (const place of locateQuoteParts(evidence, posting)) add(place, "main");
  for (const h of hints) {
    for (const place of locateQuoteParts(h.quote, posting, { wholeWord: true })) add(place, "hint");
  }
  return marks;
}
