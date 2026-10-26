// Finds the evidence sentence inside the posting text so the UI can mark it in
// place. Matching follows quoteIsInPosting: whitespace runs collapse to one
// space and case is ignored. Returns offsets into the ORIGINAL text.
import { normalizeText } from "~/lib/eligibility/verify";

export interface Range {
  start: number;
  end: number;
}

// Letters, digits and underscore in any script: what counts as "inside a word".
const WORD_CHAR = /[\p{L}\p{N}_]/u;

function isWordChar(ch: string | undefined): boolean {
  return ch !== undefined && WORD_CHAR.test(ch);
}

// Prefers a match that starts and ends on word boundaries, so "India" marks
// "India" and not the front of "Indian". A boundary is only required on a side
// where the quote itself begins/ends with a word character ("(US only)" needs
// none). Without `wholeWord`, falls back to the first match inside a word.
export function findQuoteRange(
  text: string,
  quote: string,
  opts: { wholeWord?: boolean } = {},
): Range | null {
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

  // q is trimmed, so its last character is never a collapsed space.
  const toRange = (at: number): Range => ({ start: from[at], end: from[at + q.length - 1] + 1 });
  const needStart = isWordChar(q[0]);
  const needEnd = isWordChar(q[q.length - 1]);
  let first = -1;
  for (let at = norm.indexOf(q); at >= 0; at = norm.indexOf(q, at + 1)) {
    if (first < 0) first = at;
    const startOk = !needStart || !isWordChar(norm[at - 1]);
    const endOk = !needEnd || !isWordChar(norm[at + q.length]);
    if (startOk && endOk) return toRange(at);
  }
  return first >= 0 && !opts.wholeWord ? toRange(first) : null;
}

export function splitAtRange(text: string, range: Range | null): [string, string, string] | null {
  if (!range) return null;
  return [text.slice(0, range.start), text.slice(range.start, range.end), text.slice(range.end)];
}

// A marked run in one field: the main evidence, or one of the other hints.
export interface Mark extends Range {
  kind: "main" | "hint";
}

export interface Segment {
  text: string;
  kind: Mark["kind"] | null;
}

// Cuts `text` into plain and marked runs. Marks come in priority order: one that
// overlaps an earlier mark is dropped, so the main evidence keeps its mark.
export function markSegments(text: string, marks: Mark[]): Segment[] {
  const kept: Mark[] = [];
  for (const m of marks) {
    if (m.start >= m.end || m.start < 0 || m.end > text.length) continue;
    if (kept.some((k) => m.start < k.end && k.start < m.end)) continue;
    kept.push(m);
  }
  kept.sort((a, b) => a.start - b.start);

  const out: Segment[] = [];
  let at = 0;
  for (const m of kept) {
    if (m.start > at) out.push({ text: text.slice(at, m.start), kind: null });
    out.push({ text: text.slice(m.start, m.end), kind: m.kind });
    at = m.end;
  }
  if (at < text.length || out.length === 0) out.push({ text: text.slice(at), kind: null });
  return out;
}
