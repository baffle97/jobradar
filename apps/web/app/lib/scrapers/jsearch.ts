import { dedupHash } from "./dedup";
import { upsertJobs } from "./upsert";

interface JSearchJob {
  job_title: string;
  employer_name: string;
  job_city: string;
  job_state: string;
  job_country: string;
  job_min_salary: number | null;
  job_max_salary: number | null;
  job_description: string;
  job_apply_link: string;
  job_posted_at_datetime_utc: string;
  job_is_remote: boolean;
  job_employment_type: string;
}

interface JSearchResponse {
  status: string;
  data: JSearchJob[];
}

function mapEmploymentType(type: string): string | undefined {
  if (!type) return undefined;
  const lower = type.toLowerCase();
  if (lower === "fulltime") return "full-time";
  if (lower === "contractor") return "contract";
  if (lower === "parttime") return "part-time";
  return undefined;
}

export async function scrapeJSearch(): Promise<{ inserted: number; total: number }> {
  const apiKey = process.env.RAPIDAPI_KEY;
  if (!apiKey) {
    throw new Error("RAPIDAPI_KEY is required");
  }

  const queries = ["software engineer", "frontend developer", "backend developer"];
  const allJobs: Parameters<typeof upsertJobs>[0] = [];

  for (const query of queries) {
    const url = `https://jsearch.p.rapidapi.com/search?query=${encodeURIComponent(query)}&num_pages=1&page=1`;

    const res = await fetch(url, {
      headers: {
        "x-rapidapi-key": apiKey,
        "x-rapidapi-host": "jsearch.p.rapidapi.com",
      },
    });

    if (!res.ok) {
      console.warn(`[jsearch] query "${query}" failed: ${res.status}`);
      continue;
    }

    const data: JSearchResponse = await res.json();
    if (!data.data) continue;

    for (const j of data.data) {
      const location = [j.job_city, j.job_state, j.job_country].filter(Boolean).join(", ");
      allJobs.push({
        title: j.job_title,
        company: j.employer_name,
        location: location || undefined,
        salaryMin: j.job_min_salary ? Math.round(j.job_min_salary) : undefined,
        salaryMax: j.job_max_salary ? Math.round(j.job_max_salary) : undefined,
        description: j.job_description,
        source: "jsearch" as const,
        sourceUrl: j.job_apply_link,
        workMode: j.job_is_remote ? ("remote" as const) : undefined,
        jobType: mapEmploymentType(j.job_employment_type),
        postedAt: j.job_posted_at_datetime_utc,
        dedupHash: dedupHash(j.job_title, j.employer_name, location),
      });
    }
  }

  const result = upsertJobs(allJobs);
  console.log(`[jsearch] inserted ${result.inserted}/${result.total} jobs`);
  return result;
}
