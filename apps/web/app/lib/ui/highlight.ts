// Finds the evidence sentence inside the posting text so the UI can mark it in
// place. Matching follows quoteIsInPosting: whitespace runs collapse to one
// space and case is ignored. Returns offsets into the ORIGINAL text.
import { normalizeText } from "~/lib/eligibility/verify";

export interface Range {
  start: number;
  end: number;
}

export function findQuoteRange(text: string, quote: string): Range | null {
  const q = normalizeText(quote);
  if (!q || !text) return null;

  // Build the normalized text and, for each of its characters, the index of the
  // original character it came from.
  let norm = "";
  const from: number[] = [];
  let i = 0;
  while (i < text.length) {
    if (/\s/.test(text[i])) {
      const runStart = i;
      while (i < text.length && /\s/.test(text[i])) i++;
      norm += " ";
      from.push(runStart);
      continue;
    }
    const lower = text[i].toLowerCase();
    for (let k = 0; k < lower.length; k++) {
      norm += lower[k];
      from.push(i);
    }
    i++;
  }

  const at = norm.indexOf(q);
  if (at < 0) return null;
  // q is trimmed, so its last character is never a collapsed space.
  return { start: from[at], end: from[at + q.length - 1] + 1 };
}

export function splitAtRange(text: string, range: Range | null): [string, string, string] | null {
  if (!range) return null;
  return [text.slice(0, range.start), text.slice(range.start, range.end), text.slice(range.end)];
}
