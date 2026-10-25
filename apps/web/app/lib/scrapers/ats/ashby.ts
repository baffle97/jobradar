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

interface AshbyCompensationComponent {
  compensationType: string;
  interval: string;
  currencyCode: string | null;
  minValue: number | null;
  maxValue: number | null;
}

export interface AshbyJob {
  id: string;
  title: string;
  location?: string | null;
  secondaryLocations?: { location?: string | null }[];
  isListed?: boolean;
  isRemote?: boolean | null;
  workplaceType?: string | null;
  employmentType?: string | null;
  publishedAt?: string | null;
  jobUrl: string;
  applyUrl?: string | null;
  descriptionPlain?: string | null;
  descriptionHtml?: string | null;
  compensation?: {
    compensationTierSummary?: string | null;
    scrapeableCompensationSalarySummary?: string | null;
    summaryComponents?: AshbyCompensationComponent[];
  } | null;
}

export interface AshbyResponse {
  jobs: AshbyJob[];
}

const WORKPLACE: Record<string, WorkMode> = {
  remote: "remote",
  hybrid: "hybrid",
  onsite: "onsite",
};

const EMPLOYMENT: Record<string, JobType> = {
  fulltime: "full-time",
  contract: "contract",
  parttime: "part-time",
};

export function normalizeAshby(
  token: string,
  data: AshbyResponse,
  companyName?: string,
): BoardJob[] {
  const company = companyName ?? companyFromToken(token);

  return data.jobs
    .filter((j) => j.isListed !== false)
    .map((j) => {
      const locations = [j.location, ...(j.secondaryLocations ?? []).map((s) => s.location)]
        .filter((l): l is string => Boolean(l?.trim()))
        .map((l) => l.trim());

      const workMode =
        WORKPLACE[(j.workplaceType ?? "").toLowerCase()] ??
        (j.isRemote ? "remote" : inferWorkMode(locations));

      const salary = j.compensation?.summaryComponents?.find(
        (c) => c.compensationType === "Salary" && c.interval === "1 YEAR",
      );

      return {
        externalId: j.id,
        title: j.title.trim(),
        company,
        locations,
        workMode,
        jobType: EMPLOYMENT[(j.employmentType ?? "").toLowerCase()],
        description: j.descriptionPlain?.trim() || htmlToText(j.descriptionHtml ?? ""),
        sourceUrl: j.jobUrl,
        applyUrl: j.applyUrl ?? undefined,
        postedAt: j.publishedAt ?? undefined,
        salaryMin: salary?.minValue ?? undefined,
        salaryMax: salary?.maxValue ?? undefined,
        salaryCurrency: salary?.currencyCode ?? undefined,
        salaryText:
          j.compensation?.compensationTierSummary ??
          j.compensation?.scrapeableCompensationSalarySummary ??
          undefined,
      };
    });
}

export async function fetchAshbyBoard(
  token: string,
  companyName?: string,
): Promise<BoardFetchResult> {
  const { status, body } = await fetchBoardJson(
    `https://api.ashbyhq.com/posting-api/job-board/${encodeURIComponent(token)}?includeCompensation=true`,
  );
  if (status === 404) return { status: "not_found" };
  return { status: "ok", jobs: normalizeAshby(token, body as AshbyResponse, companyName) };
}
