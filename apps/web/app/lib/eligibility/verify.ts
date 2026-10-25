import type { Posting } from "./types";

// Collapse every whitespace run (newlines, tabs, nbsp) to one space and ignore case.
export function normalizeText(s: string): string {
  return s.replace(/\s+/g, " ").trim().toLowerCase();
}

// "No quote, no verdict": evidence must sit verbatim inside ONE field of the
// posting (title, a location string, or the description). Fields are checked
// one by one so a quote cannot be stitched across them.
export function quoteIsInPosting(quote: string, posting: Posting): boolean {
  const q = normalizeText(quote);
  if (!q) return false;
  const fields = [posting.title, ...posting.locations, posting.description];
  return fields.some((field) => normalizeText(field ?? "").includes(q));
}
