import { dedupHash } from "./dedup";
import { upsertJobs } from "./upsert";

interface AdzunaResult {
  title: string;
  company: { display_name: string };
  location: { display_name: string };
  salary_min?: number;
  salary_max?: number;
  description: string;
  redirect_url: string;
  created: string;
  category: { label: string };
}

interface AdzunaResponse {
  results: AdzunaResult[];
  count: number;
}

const CATEGORIES = ["it-jobs", "engineering-jobs"];
const COUNTRIES = ["us", "gb", "in"];

export async function scrapeAdzuna(): Promise<{ inserted: number; total: number }> {
  const appId = process.env.ADZUNA_APP_ID;
  const apiKey = process.env.ADZUNA_API_KEY;
  if (!appId || !apiKey) {
    throw new Error("ADZUNA_APP_ID and ADZUNA_API_KEY are required");
  }

  const allJobs: Parameters<typeof upsertJobs>[0] = [];

  for (const country of COUNTRIES) {
    for (const category of CATEGORIES) {
      const url = `https://api.adzuna.com/v1/api/jobs/${country}/search/1?app_id=${appId}&app_key=${apiKey}&results_per_page=50&what=software+engineer&category=${category}`;

      const res = await fetch(url);
      if (!res.ok) {
        console.warn(`[adzuna] ${country}/${category} failed: ${res.status}`);
        continue;
      }

      const data: AdzunaResponse = await res.json();

      for (const r of data.results) {
        allJobs.push({
          title: r.title,
          company: r.company.display_name,
          location: r.location.display_name,
          salaryMin: r.salary_min ? Math.round(r.salary_min) : undefined,
          salaryMax: r.salary_max ? Math.round(r.salary_max) : undefined,
          description: r.description,
          source: "adzuna",
          sourceUrl: r.redirect_url,
          postedAt: r.created,
          dedupHash: dedupHash(r.title, r.company.display_name, r.location.display_name),
        });
      }
    }
  }

  const result = upsertJobs(allJobs);
  console.log(`[adzuna] inserted ${result.inserted}/${result.total} jobs`);
  return result;
}
