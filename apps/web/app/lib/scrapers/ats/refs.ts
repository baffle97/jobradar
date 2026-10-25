import { decodeEntities } from "~/lib/text";
import type { BoardRef } from "./types";

// EU-hosted boards (job-boards.eu.greenhouse.io, jobs.eu.lever.co) use different
// API hosts and are not handled yet.
const PATTERNS: { ats: BoardRef["ats"]; re: RegExp }[] = [
  { ats: "ashby", re: /jobs\.ashbyhq\.com\/([A-Za-z0-9._%-]+)/g },
  {
    ats: "greenhouse",
    re: /(?:boards|job-boards)\.greenhouse\.io\/(?:embed\/job_board\?for=)?([A-Za-z0-9_-]+)/g,
  },
  { ats: "greenhouse", re: /greenhouse\.io\/embed\/job_board(?:\/js)?\?for=([A-Za-z0-9_-]+)/g },
  { ats: "lever", re: /jobs\.lever\.co\/([A-Za-z0-9._-]+)/g },
];

const NOT_TOKENS = new Set(["embed", "api", "v1", "jobs", "job_app"]);

export function extractBoardRefs(rawText: string): BoardRef[] {
  const text = decodeEntities(rawText);
  const seen = new Map<string, BoardRef>();

  for (const { ats, re } of PATTERNS) {
    for (const match of text.matchAll(re)) {
      let token = match[1];
      try {
        token = decodeURIComponent(token);
      } catch {
        // keep the raw token
      }
      token = token.replace(/[.]+$/, "");
      if (!token || NOT_TOKENS.has(token.toLowerCase())) continue;
      const key = `${ats}:${token.toLowerCase()}`;
      if (!seen.has(key)) seen.set(key, { ats, token });
    }
  }

  return [...seen.values()];
}

const normalizeName = (name: string) => name.toLowerCase().replace(/[^a-z0-9]/g, "");

// A guessed token like "tempo" or "hive" can belong to a different company.
// Greenhouse names the board's company, so compare names. Ashby and Lever don't,
// so require the company's name as a whole word in at least one posting.
export function boardBelongsTo(
  expectedName: string,
  boardCompanyName: string | undefined,
  jobs: { description: string }[],
): boolean {
  if (boardCompanyName) return normalizeName(boardCompanyName) === normalizeName(expectedName);
  const escaped = expectedName.trim().replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  if (!escaped) return false;
  const word = new RegExp(`(^|[^A-Za-z0-9])${escaped}($|[^A-Za-z0-9])`, "i");
  return jobs.some((j) => word.test(j.description));
}

export function registrableDomain(website?: string | null): string | undefined {
  if (!website) return undefined;
  try {
    const host = new URL(website.startsWith("http") ? website : `https://${website}`).hostname
      .toLowerCase()
      .replace(/^www\./, "");
    const labels = host.split(".");
    if (labels.length < 2) return undefined;
    // "acme.co.uk" keeps three labels; "go.acme.com" drops the subdomain.
    const keep = labels.length >= 3 && labels[labels.length - 2].length <= 3 ? 3 : 2;
    return labels.slice(-keep).join(".");
  } catch {
    return undefined;
  }
}

const MIN_DISTINCT_TOKEN = 6;

// Short generic tokens ("tempo", "hive", "radar") were taken by unrelated
// companies about half the time when checked by hand, so a guessed YC board is
// trusted only if its postings mention the company's domain, or if the token is
// the domain's own name, long enough to be distinctive, and the name checks out.
export function ycBoardIsTrusted(args: {
  token: string;
  website?: string | null;
  companyName: string;
  boardCompanyName?: string;
  jobs: { description: string; sourceUrl?: string; applyUrl?: string }[];
}): boolean {
  const domain = registrableDomain(args.website);
  if (!domain) return false;

  const text = args.jobs
    .map((j) => `${j.description} ${j.sourceUrl ?? ""} ${j.applyUrl ?? ""}`)
    .join(" ")
    .toLowerCase();
  if (text.includes(domain)) return true;

  const stem = domain.split(".")[0];
  return (
    args.token.toLowerCase() === stem &&
    stem.length >= MIN_DISTINCT_TOKEN &&
    boardBelongsTo(args.companyName, args.boardCompanyName, args.jobs)
  );
}

// Candidate board tokens for a company we only know by name/slug/website.
export function candidateTokens(slug: string, website?: string | null): string[] {
  const out = new Set<string>();
  if (slug) out.add(slug.toLowerCase());
  if (website) {
    try {
      const host = new URL(website.startsWith("http") ? website : `https://${website}`).hostname;
      const stem = host.replace(/^www\./, "").split(".")[0];
      if (stem) out.add(stem.toLowerCase());
    } catch {
      // ignore malformed websites
    }
  }
  return [...out];
}
