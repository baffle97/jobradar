// A saved job's place in the user's own pipeline. Moving it is a choice the
// user makes; nothing here applies anywhere.
export const SAVED_STATUSES = ["saved", "applied", "interviewing", "offer", "rejected"] as const;
export type SavedStatus = (typeof SAVED_STATUSES)[number];

export const STATUS_LABELS: Record<SavedStatus, string> = {
  saved: "Saved",
  applied: "Applied",
  interviewing: "Interviewing",
  offer: "Offer",
  rejected: "Rejected",
};

export function parseSavedStatus(raw: unknown): SavedStatus | null {
  return SAVED_STATUSES.find((s) => s === raw) ?? null;
}

// Where a no-JS form goes back to after saving: a path on this site only.
export function safeReturnTo(raw: unknown, fallback = "/"): string {
  if (typeof raw !== "string" || !raw.startsWith("/") || raw.startsWith("//")) return fallback;
  if (raw.includes("\\")) return fallback;
  return raw;
}
