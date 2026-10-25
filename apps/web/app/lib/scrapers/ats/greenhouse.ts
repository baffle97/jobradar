import { decodeEntities, htmlToText } from "~/lib/text";
import { type BoardFetchResult, type BoardJob, fetchBoardJson, inferWorkMode } from "./types";

interface GreenhousePayRange {
  min_cents: number | null;
  max_cents: number | null;
  currency_type: string | null;
  title: string | null;
}

export interface GreenhouseJob {
  id: number;
  title: string;
  absolute_url: string;
  company_name?: string | null;
  location?: { name?: string | null } | null;
  offices?: { name?: string | null; location?: string | null }[];
  content?: string | null;
  first_published?: string | null;
  updated_at?: string | null;
  pay_input_ranges?: GreenhousePayRange[];
}

export interface GreenhouseResponse {
  jobs: GreenhouseJob[];
}

function formatRange(r: GreenhousePayRange): string {
  const fmt = (cents: number | null) =>
    cents == null ? "?" : Math.round(cents / 100).toLocaleString("en-US");
  const title = r.title?.trim().replace(/:+$/, "");
  const label = title ? `${title}: ` : "";
  return `${label}${r.currency_type ?? ""} ${fmt(r.min_cents)} – ${fmt(r.max_cents)}`.trim();
}

export function normalizeGreenhouse(token: string, data: GreenhouseResponse): BoardJob[] {
  return data.jobs.map((j) => {
    // Greenhouse joins multiple locations into one string: "Remote, Canada; Remote, US".
    const fromLocation = (j.location?.name ?? "")
      .split(";")
      .map((l) => l.trim())
      .filter(Boolean);
    const fromOffices = (j.offices ?? [])
      .map((o) => (o.location ?? o.name ?? "").trim())
      .filter(Boolean);
    const locations = [...new Set([...fromLocation, ...fromOffices])];

    const ranges = j.pay_input_ranges ?? [];
    const first = ranges[0];

    return {
      externalId: String(j.id),
      title: j.title.trim(),
      company: j.company_name?.trim() || token,
      locations,
      workMode: inferWorkMode(locations),
      // `content` is HTML that has itself been entity-escaped, so decode before stripping.
      description: htmlToText(decodeEntities(j.content ?? "")),
      sourceUrl: j.absolute_url,
      postedAt: j.first_published ?? j.updated_at ?? undefined,
      salaryMin: first?.min_cents != null ? Math.round(first.min_cents / 100) : undefined,
      salaryMax: first?.max_cents != null ? Math.round(first.max_cents / 100) : undefined,
      salaryCurrency: first?.currency_type ?? undefined,
      salaryText: ranges.length ? ranges.map(formatRange).join("; ") : undefined,
    };
  });
}

export async function fetchGreenhouseBoard(token: string): Promise<BoardFetchResult> {
  const { status, body } = await fetchBoardJson(
    `https://boards-api.greenhouse.io/v1/boards/${encodeURIComponent(token)}/jobs?content=true&pay_transparency=true`,
  );
  if (status === 404) return { status: "not_found" };
  const jobs = normalizeGreenhouse(token, body as GreenhouseResponse);
  return { status: "ok", companyName: jobs[0]?.company, jobs };
}
