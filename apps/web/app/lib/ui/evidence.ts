import { normalizeText } from "~/lib/eligibility/verify";
import { findQuoteRange, type Range } from "./highlight";

export type EvidencePlace =
  | { field: "description"; range: Range }
  | { field: "title"; range: Range }
  | { field: "location"; index: number; range: Range };

// Which field of the posting the evidence quote came from, and where in it.
// A quote that IS one of the locations ("India") is marked there. Otherwise the
// short fields (title, then locations) come before the description, and a
// whole-word match anywhere beats a match inside a word ("US" in "businesses").
export function locateEvidence(
  evidence: string | null,
  posting: { title: string; locations: string[]; description: string },
): EvidencePlace | null {
  if (!evidence) return null;
  const q = normalizeText(evidence);
  if (!q) return null;
  const exact = posting.locations.findIndex((loc) => normalizeText(loc) === q);
  if (exact >= 0) {
    const range = findQuoteRange(posting.locations[exact], evidence);
    if (range) return { field: "location", index: exact, range };
  }
  for (const wholeWord of [true, false]) {
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
