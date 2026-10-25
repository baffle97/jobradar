// Date and number formatting that gives the same string on the server (UTC)
// and in the browser (IST), so React hydration never sees two versions.
// Everything takes an explicit "now" from the loader instead of Date.now().

// India has no DST, so a fixed offset is exact.
export const IST_OFFSET_MINUTES = 330;

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

function toMs(iso: string | null | undefined): number | null {
  if (!iso) return null;
  const ms = Date.parse(iso);
  return Number.isFinite(ms) ? ms : null;
}

// When the posting says it was published, falling back to when we first saw it.
export function jobDate(job: { postedAt: string | null; createdAt: string }): string {
  return toMs(job.postedAt) !== null ? (job.postedAt as string) : job.createdAt;
}

// "25 Oct", or "25 Oct 2025" when the year differs from `nowIso`'s year. Days are IST days.
export function formatDay(iso: string, nowIso?: string): string {
  const ms = toMs(iso);
  if (ms === null) return "";
  const d = new Date(ms + IST_OFFSET_MINUTES * 60_000);
  const day = `${d.getUTCDate()} ${MONTHS[d.getUTCMonth()]}`;
  const nowMs = toMs(nowIso);
  if (nowMs === null) return `${day} ${d.getUTCFullYear()}`;
  const nowYear = new Date(nowMs + IST_OFFSET_MINUTES * 60_000).getUTCFullYear();
  return nowYear === d.getUTCFullYear() ? day : `${day} ${d.getUTCFullYear()}`;
}

// Short relative age: "40m ago", "3h ago", "5d ago", then a date after two weeks.
export function formatAge(iso: string, nowIso: string): string {
  const ms = toMs(iso);
  const nowMs = toMs(nowIso);
  if (ms === null || nowMs === null) return "";
  const minutes = Math.floor((nowMs - ms) / 60_000);
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 14) return `${days}d ago`;
  return formatDay(iso, nowIso);
}

export function isNew(iso: string, nowIso: string, hours = 48): boolean {
  const ms = toMs(iso);
  const nowMs = toMs(nowIso);
  if (ms === null || nowMs === null) return false;
  return nowMs - ms <= hours * 3_600_000;
}

// 12345 -> "12,345" without toLocaleString (its output depends on the runtime's locale).
export function formatCount(n: number): string {
  return String(Math.trunc(n)).replace(/\B(?=(\d{3})+(?!\d))/g, ",");
}
