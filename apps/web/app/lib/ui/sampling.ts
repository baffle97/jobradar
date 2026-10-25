// Order in which /label shows postings for hand labelling. Stratified so the
// 200-label eval set is not just "not eligible" from the biggest board:
// postings are grouped by (source, agent verdict) and the groups take turns.
// Deterministic (hash of the id), so a refresh never reshuffles.

export interface LabelCandidate {
  id: number;
  source: string;
  verdict: string | null;
}

// 32-bit FNV-1a.
export function fnv1a(input: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < input.length; i++) {
    h ^= input.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h >>> 0;
}

export function stratifiedOrder<T extends LabelCandidate>(items: T[]): T[] {
  const groups = new Map<string, T[]>();
  for (const item of items) {
    const key = `${item.source}|${item.verdict ?? "none"}`;
    const group = groups.get(key);
    if (group) group.push(item);
    else groups.set(key, [item]);
  }
  const keyed = (x: T) => fnv1a(`label:${x.id}`);
  const queues = [...groups.keys()]
    .sort()
    .map((key) =>
      (groups.get(key) as T[]).slice().sort((a, b) => keyed(a) - keyed(b) || a.id - b.id),
    );

  const out: T[] = [];
  for (let round = 0; out.length < items.length; round++) {
    for (const queue of queues) {
      if (round < queue.length) out.push(queue[round]);
    }
  }
  return out;
}

// First unlabelled posting at or after `from`, wrapping around so skipped ones come back.
export function pickNext<T extends LabelCandidate>(
  order: T[],
  labelled: Set<number>,
  from: number,
): { item: T; position: number } | null {
  const n = order.length;
  if (n === 0) return null;
  const start = Number.isFinite(from) && from > 0 ? Math.floor(from) % n : 0;
  for (let k = 0; k < n; k++) {
    const position = (start + k) % n;
    if (!labelled.has(order[position].id)) return { item: order[position], position };
  }
  return null;
}
