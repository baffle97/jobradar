import { findQuoteRange, type Range } from "./highlight";

export type EvidencePlace =
  | { field: "description"; range: Range }
  | { field: "title"; range: Range }
  | { field: "location"; index: number; range: Range };

// Which field of the posting the evidence quote came from, and where in it.
export function locateEvidence(
  evidence: string | null,
  posting: { title: string; locations: string[]; description: string },
): EvidencePlace | null {
  if (!evidence) return null;
  const inDescription = findQuoteRange(posting.description, evidence);
  if (inDescription) return { field: "description", range: inDescription };
  const inTitle = findQuoteRange(posting.title, evidence);
  if (inTitle) return { field: "title", range: inTitle };
  for (let index = 0; index < posting.locations.length; index++) {
    const range = findQuoteRange(posting.locations[index], evidence);
    if (range) return { field: "location", index, range };
  }
  return null;
}
