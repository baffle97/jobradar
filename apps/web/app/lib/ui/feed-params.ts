// The feed's state lives in the URL only (works without JS, Back works). One
// parser and one href builder, so every link and form carries every param.
import { MIN_PAY, type MinPay, minPayLabel } from "./pay";
import { parseRole, type RoleKey, roleLabel } from "./roles";
import { type FeedFilter, parseFeedFilter } from "./verdict";

export const MAX_SHOWN = 400;

export const AGES = [1, 7, 30] as const;
export type AgeDays = (typeof AGES)[number];
export const AGE_LABELS: Record<AgeDays, string> = {
  1: "Last 24 hours",
  7: "Last 7 days",
  30: "Last 30 days",
};

export const SOURCES = ["ats", "hn", "remotive"] as const;
export type SourceKey = (typeof SOURCES)[number];
export const SOURCE_LABELS: Record<SourceKey, string> = {
  ats: "Company boards (ATS)",
  hn: "Hacker News",
  remotive: "Remotive",
};
// jobs.source values behind each choice.
export const SOURCE_VALUES: Record<SourceKey, string[]> = {
  ats: ["greenhouse", "lever", "ashby"],
  hn: ["hn"],
  remotive: ["remotive"],
};

export type FeedSort = "best" | "new";
export type FeedView = "cards" | "list";

export interface FeedParams {
  v: FeedFilter;
  q: string;
  // How many rows to show: one step .. MAX_SHOWN.
  n: number;
  role: RoleKey | null;
  age: AgeDays | null;
  src: SourceKey | null;
  pay: boolean;
  // Top of the posted range is at least this many lakh rupees a month (lib/ui/pay.ts).
  min: MinPay | null;
  // "explicit": hide verdicts that only rest on hints. Eligible/open views only.
  basis: "explicit" | null;
  sort: FeedSort;
  view: FeedView;
}

export function feedStep(view: FeedView): number {
  return view === "list" ? 50 : 20;
}

export function basisApplies(v: FeedFilter): boolean {
  return v === "open" || v === "eligible";
}

function pick<T extends string | number>(options: readonly T[], raw: string | null): T | null {
  return options.find((o) => String(o) === raw) ?? null;
}

export function parseFeedParams(sp: URLSearchParams): FeedParams {
  const v = parseFeedFilter(sp.get("v"));
  const view: FeedView = sp.get("view") === "list" ? "list" : "cards";
  const step = feedStep(view);
  return {
    v,
    q: (sp.get("q") ?? "").trim().slice(0, 100),
    n: Math.min(MAX_SHOWN, Math.max(step, Number(sp.get("n")) || step)),
    role: parseRole(sp.get("role")),
    age: pick(AGES, sp.get("age")),
    src: pick(SOURCES, sp.get("src")),
    pay: sp.get("pay") === "1",
    min: pick(MIN_PAY, sp.get("min")),
    basis: basisApplies(v) && sp.get("basis") === "explicit" ? "explicit" : null,
    sort: sp.get("sort") === "new" ? "new" : "best",
    view,
  };
}

// URL for `p` with `changes` applied. Any change starts the list from the top
// again (n back to one step) unless `changes` sets n. Defaults are left out.
export function feedHref(p: FeedParams, changes: Partial<FeedParams> = {}): string {
  const next: FeedParams = { ...p, n: 0, ...changes };
  const sp = new URLSearchParams();
  if (next.v !== "open") sp.set("v", next.v);
  if (next.q) sp.set("q", next.q);
  if (next.n > feedStep(next.view)) sp.set("n", String(next.n));
  if (next.role) sp.set("role", next.role);
  if (next.age) sp.set("age", String(next.age));
  if (next.src) sp.set("src", next.src);
  if (next.pay) sp.set("pay", "1");
  if (next.min) sp.set("min", String(next.min));
  if (next.basis && basisApplies(next.v)) sp.set("basis", next.basis);
  if (next.sort !== "best") sp.set("sort", next.sort);
  if (next.view !== "cards") sp.set("view", next.view);
  const s = sp.toString();
  return s ? `/?${s}` : "/";
}

export interface FilterChip {
  key: "role" | "age" | "src" | "pay" | "min" | "basis";
  label: string;
  // The same view without this filter.
  href: string;
}

// The filters that narrow the list (sort and view only reorder or restyle it).
export function activeFilters(p: FeedParams): FilterChip[] {
  const chips: FilterChip[] = [];
  if (p.role)
    chips.push({ key: "role", label: roleLabel(p.role), href: feedHref(p, { role: null }) });
  if (p.age) chips.push({ key: "age", label: AGE_LABELS[p.age], href: feedHref(p, { age: null }) });
  if (p.src) {
    chips.push({ key: "src", label: SOURCE_LABELS[p.src], href: feedHref(p, { src: null }) });
  }
  if (p.pay) chips.push({ key: "pay", label: "Salary listed", href: feedHref(p, { pay: false }) });
  if (p.min)
    chips.push({ key: "min", label: minPayLabel(p.min), href: feedHref(p, { min: null }) });
  if (p.basis) {
    chips.push({ key: "basis", label: "Explicit lines only", href: feedHref(p, { basis: null }) });
  }
  return chips;
}

export function clearFiltersHref(p: FeedParams): string {
  return feedHref(p, { role: null, age: null, src: null, pay: false, min: null, basis: null });
}

const PARAM_KEYS = ["v", "q", "n", "role", "age", "src", "pay", "min", "basis", "sort", "view"];

// Where to redirect a feed URL that carries empty, default or invalid params
// (the no-JS filter form sends "age=&src=&sort=best"); null when it is clean.
// Order does not matter; params the feed does not know are kept.
export function cleanFeedHref(sp: URLSearchParams): string | null {
  const p = parseFeedParams(sp);
  const canonical = new URLSearchParams(feedHref(p, { n: p.n }).split("?")[1] ?? "");
  const dirty = [...sp.keys()].some(
    (key) => PARAM_KEYS.includes(key) && sp.get(key) !== canonical.get(key),
  );
  if (!dirty) return null;
  for (const [key, value] of sp) if (!PARAM_KEYS.includes(key)) canonical.append(key, value);
  const s = canonical.toString();
  return s ? `/?${s}` : "/";
}
