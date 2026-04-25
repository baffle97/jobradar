import { dedupHash } from "./dedup";
import { upsertJobs } from "./upsert";

interface RemotiveJob {
  id: number;
  url: string;
  title: string;
  company_name: string;
  category: string;
  job_type: string;
  publication_date: string;
  candidate_required_location: string;
  salary: string;
  description: string;
}

interface RemotiveResponse {
  jobs: RemotiveJob[];
}

function parseSalary(salary: string): { min?: number; max?: number } {
  if (!salary) return {};
  const numbers =
    salary.match(/[\d,]+/g)?.map((n) => Number.parseInt(n.replace(/,/g, ""), 10)) ?? [];
  if (numbers.length >= 2) return { min: numbers[0], max: numbers[1] };
  if (numbers.length === 1) return { min: numbers[0] };
  return {};
}

function stripHtml(html: string): string {
  return html
    .replace(/<[^>]*>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function mapJobType(type: string): string | undefined {
  const lower = type.toLowerCase();
  if (lower.includes("full")) return "full-time";
  if (lower.includes("contract") || lower.includes("freelance")) return "contract";
  if (lower.includes("part")) return "part-time";
  return undefined;
}

export async function scrapeRemotive(): Promise<{ inserted: number; total: number }> {
  const url = "https://remotive.com/api/remote-jobs?category=software-dev&limit=100";

  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`Remotive API failed: ${res.status}`);
  }

  const data: RemotiveResponse = await res.json();

  const allJobs: Parameters<typeof upsertJobs>[0] = data.jobs.map((j) => {
    const salary = parseSalary(j.salary);
    return {
      title: j.title,
      company: j.company_name,
      location: j.candidate_required_location || "Remote",
      salaryMin: salary.min,
      salaryMax: salary.max,
      description: stripHtml(j.description),
      source: "remotive" as const,
      sourceUrl: j.url,
      workMode: "remote" as const,
      jobType: mapJobType(j.job_type),
      postedAt: j.publication_date,
      dedupHash: dedupHash(j.title, j.company_name, j.candidate_required_location || "Remote"),
    };
  });

  const result = upsertJobs(allJobs);
  console.log(`[remotive] inserted ${result.inserted}/${result.total} jobs`);
  return result;
}
