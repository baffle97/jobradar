import { dedupHash } from "./dedup";
import { upsertJobs } from "./upsert";

const HN_API = "https://hacker-news.firebaseio.com/v0";

interface HNItem {
  id: number;
  type: string;
  by: string;
  text?: string;
  kids?: number[];
  title?: string;
  time: number;
}

interface ParsedHNJob {
  company: string;
  title: string;
  location: string;
  remote: boolean;
  url: string;
  salary: string;
  description: string;
}

function parseHNComment(text: string): ParsedHNJob | null {
  if (!text) return null;

  const clean = text
    .replace(/<[^>]*>/g, "\n")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&#x27;/g, "'")
    .replace(/&quot;/g, '"');

  const lines = clean
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean);
  if (lines.length === 0) return null;

  const firstLine = lines[0];

  // HN format is typically: Company | Role | Location | Remote | Salary | URL
  const parts = firstLine.split("|").map((p) => p.trim());
  if (parts.length < 2) return null;

  const company = parts[0];
  const title = parts[1];
  const location =
    parts.find((p) => /remote|onsite|hybrid|nyc|sf|london|berlin|us|eu/i.test(p)) ?? "";
  const remote = /remote/i.test(firstLine);
  const salaryPart = parts.find((p) => /\$|€|£|k\b|salary/i.test(p)) ?? "";
  const urlMatch = clean.match(/https?:\/\/[^\s<]+/);
  const description = lines.slice(1).join(" ").substring(0, 2000);

  if (!company || !title) return null;

  return {
    company,
    title,
    location: location || (remote ? "Remote" : ""),
    remote,
    url: urlMatch?.[0] ?? "",
    salary: salaryPart,
    description,
  };
}

function parseSalaryRange(salary: string): { min?: number; max?: number } {
  if (!salary) return {};
  const numbers =
    salary.match(/[\d,]+k?/gi)?.map((n) => {
      const num = Number.parseInt(n.replace(/[,k]/gi, ""), 10);
      return n.toLowerCase().includes("k") ? num * 1000 : num;
    }) ?? [];
  if (numbers.length >= 2) return { min: numbers[0], max: numbers[1] };
  if (numbers.length === 1) return { min: numbers[0] };
  return {};
}

async function findWhoIsHiringThread(): Promise<number | null> {
  const res = await fetch(`${HN_API}/user/whoishiring.json`);
  if (!res.ok) return null;
  const user = await res.json();

  for (const storyId of user.submitted.slice(0, 10)) {
    const storyRes = await fetch(`${HN_API}/item/${storyId}.json`);
    if (!storyRes.ok) continue;
    const story: HNItem = await storyRes.json();
    if (story.title?.includes("Who is hiring?")) {
      return story.id;
    }
  }
  return null;
}

export async function scrapeHN(): Promise<{ inserted: number; total: number }> {
  const threadId = await findWhoIsHiringThread();
  if (!threadId) {
    console.log("[hn] no Who is Hiring thread found");
    return { inserted: 0, total: 0 };
  }

  const threadRes = await fetch(`${HN_API}/item/${threadId}.json`);
  if (!threadRes.ok) throw new Error(`Failed to fetch HN thread: ${threadRes.status}`);
  const thread: HNItem = await threadRes.json();

  const commentIds = thread.kids?.slice(0, 200) ?? [];
  const allJobs: Parameters<typeof upsertJobs>[0] = [];

  // Fetch comments in batches of 20
  for (let i = 0; i < commentIds.length; i += 20) {
    const batch = commentIds.slice(i, i + 20);
    const comments = await Promise.all(
      batch.map(async (id) => {
        const r = await fetch(`${HN_API}/item/${id}.json`);
        return r.ok ? (r.json() as Promise<HNItem>) : null;
      }),
    );

    for (const comment of comments) {
      if (!comment?.text) continue;
      const parsed = parseHNComment(comment.text);
      if (!parsed) continue;

      const salary = parseSalaryRange(parsed.salary);
      allJobs.push({
        title: parsed.title,
        company: parsed.company,
        location: parsed.location || undefined,
        salaryMin: salary.min,
        salaryMax: salary.max,
        description: parsed.description,
        source: "hn" as const,
        sourceUrl: parsed.url || `https://news.ycombinator.com/item?id=${comment.id}`,
        workMode: parsed.remote ? ("remote" as const) : undefined,
        postedAt: new Date(comment.time * 1000).toISOString(),
        dedupHash: dedupHash(parsed.title, parsed.company, parsed.location),
      });
    }
  }

  const result = upsertJobs(allJobs);
  console.log(`[hn] inserted ${result.inserted}/${result.total} jobs`);
  return result;
}
