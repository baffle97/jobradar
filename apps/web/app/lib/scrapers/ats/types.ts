export type WorkMode = "remote" | "hybrid" | "onsite";
export type JobType = "full-time" | "contract" | "part-time";

export const ATS_LIST = ["ashby", "greenhouse", "lever"] as const;
export type Ats = (typeof ATS_LIST)[number];

export interface BoardRef {
  ats: Ats;
  token: string;
}

export interface BoardJob {
  externalId: string;
  title: string;
  company: string;
  locations: string[];
  country?: string;
  workMode?: WorkMode;
  jobType?: JobType;
  description: string;
  sourceUrl: string;
  applyUrl?: string;
  postedAt?: string;
  salaryMin?: number;
  salaryMax?: number;
  salaryCurrency?: string;
  salaryText?: string;
}

export type BoardFetchResult =
  | { status: "ok"; companyName?: string; jobs: BoardJob[] }
  | { status: "not_found" };

const USER_AGENT = "jobradar (+https://github.com/baffle97/jobradar)";

export async function fetchBoardJson(url: string): Promise<{ status: number; body: unknown }> {
  const res = await fetch(url, {
    headers: { "user-agent": USER_AGENT, accept: "application/json" },
    // Large boards are slow: Shield AI's Lever board is ~10 MB and took up to 36s.
    signal: AbortSignal.timeout(90_000),
  });
  if (res.status === 404) return { status: 404, body: null };
  if (!res.ok) throw new Error(`${url} returned ${res.status}`);
  return { status: res.status, body: await res.json() };
}

export function inferWorkMode(locations: string[]): WorkMode | undefined {
  const joined = locations.join(" ").toLowerCase();
  if (/\bremote\b/.test(joined)) return "remote";
  if (/\bhybrid\b/.test(joined)) return "hybrid";
  return undefined;
}

export function companyFromToken(token: string): string {
  return token
    .split(/[-_.]+/)
    .filter(Boolean)
    .map((part) => part[0].toUpperCase() + part.slice(1))
    .join(" ");
}
