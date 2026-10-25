import { htmlToText } from "~/lib/text";
import {
  type BoardFetchResult,
  type BoardJob,
  companyFromToken,
  fetchBoardJson,
  inferWorkMode,
  type JobType,
  type WorkMode,
} from "./types";

export interface LeverPosting {
  id: string;
  text: string;
  hostedUrl: string;
  applyUrl?: string | null;
  createdAt?: number | null;
  country?: string | null;
  workplaceType?: string | null;
  categories?: {
    location?: string | null;
    allLocations?: string[] | null;
    commitment?: string | null;
  } | null;
  descriptionPlain?: string | null;
  lists?: { text: string; content: string }[] | null;
  additionalPlain?: string | null;
  salaryRange?: {
    min?: number | null;
    max?: number | null;
    currency?: string | null;
    interval?: string | null;
  } | null;
}

const WORKPLACE: Record<string, WorkMode> = {
  remote: "remote",
  hybrid: "hybrid",
  "on-site": "onsite",
  onsite: "onsite",
};

function mapCommitment(commitment?: string | null): JobType | undefined {
  const lower = (commitment ?? "").toLowerCase();
  if (lower.includes("full")) return "full-time";
  if (lower.includes("contract") || lower.includes("freelance")) return "contract";
  if (lower.includes("part")) return "part-time";
  return undefined;
}

export function normalizeLever(
  token: string,
  data: LeverPosting[],
  companyName?: string,
): BoardJob[] {
  const company = companyName ?? companyFromToken(token);

  return data.map((p) => {
    const locations = (
      p.categories?.allLocations?.length ? p.categories.allLocations : [p.categories?.location]
    )
      .filter((l): l is string => Boolean(l?.trim()))
      .map((l) => l.trim());

    // Hiring rules ("must be based in the US") often live in the lists, not the intro.
    const description = [
      p.descriptionPlain?.trim(),
      ...(p.lists ?? []).map((l) => `${l.text}\n${htmlToText(l.content)}`),
      p.additionalPlain?.trim(),
    ]
      .filter(Boolean)
      .join("\n\n");

    const salary = p.salaryRange;
    const yearly = salary?.interval === "per-year-salary";

    return {
      externalId: p.id,
      title: p.text.trim(),
      company,
      locations,
      country: p.country ?? undefined,
      workMode: WORKPLACE[(p.workplaceType ?? "").toLowerCase()] ?? inferWorkMode(locations),
      jobType: mapCommitment(p.categories?.commitment),
      description,
      sourceUrl: p.hostedUrl,
      applyUrl: p.applyUrl ?? undefined,
      postedAt: p.createdAt ? new Date(p.createdAt).toISOString() : undefined,
      salaryMin: yearly ? (salary?.min ?? undefined) : undefined,
      salaryMax: yearly ? (salary?.max ?? undefined) : undefined,
      salaryCurrency: salary?.currency ?? undefined,
      salaryText: salary
        ? `${salary.currency ?? ""} ${salary.min ?? "?"} – ${salary.max ?? "?"} (${salary.interval ?? "unknown interval"})`.trim()
        : undefined,
    };
  });
}

export async function fetchLeverBoard(
  token: string,
  companyName?: string,
): Promise<BoardFetchResult> {
  const { status, body } = await fetchBoardJson(
    `https://api.lever.co/v0/postings/${encodeURIComponent(token)}?mode=json`,
  );
  if (status === 404) return { status: "not_found" };
  return { status: "ok", jobs: normalizeLever(token, body as LeverPosting[], companyName) };
}
