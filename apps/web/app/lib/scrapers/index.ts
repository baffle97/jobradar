import { runEligibilityCheck } from "~/lib/eligibility/task";
import { defineTask, scheduleCron } from "~/lib/scheduler";
import { scrapeAdzuna } from "./adzuna";
import { discoverFromYC, ingestBoards } from "./ats";
import { cleanupStaleJobs } from "./cleanup";
import { scrapeHN } from "./hn";
import { scrapeRemotive } from "./remotive";

async function scrapeAll() {
  const results: Record<string, unknown> = {};
  // HN runs before ATS ingest so boards it discovers are polled in the same pass.
  for (const [name, fn] of [
    ["adzuna", scrapeAdzuna],
    ["remotive", scrapeRemotive],
    ["hn", scrapeHN],
    ["ats", ingestBoards],
  ] as const) {
    try {
      results[name] = await fn();
    } catch (err) {
      results[name] = { error: err instanceof Error ? err.message : String(err) };
    }
  }
  return results;
}

export function registerScraperTasks() {
  defineTask("scrape:all", scrapeAll);
  defineTask("scrape:adzuna", scrapeAdzuna);
  defineTask("scrape:remotive", scrapeRemotive);
  defineTask("scrape:hn", scrapeHN);
  defineTask("ingest:ats", ingestBoards);
  defineTask("discover:yc", discoverFromYC);
  defineTask("cleanup:stale-jobs", cleanupStaleJobs);
  defineTask("eligibility:check", runEligibilityCheck);
}

export function scheduleScraperCrons() {
  scheduleCron("scrape:adzuna", "0 */4 * * *"); // every 4 hours
  scheduleCron("scrape:remotive", "0 */6 * * *"); // every 6 hours
  scheduleCron("scrape:hn", "0 12 * * *"); // daily; the monthly thread keeps growing
  scheduleCron("discover:yc", "0 4 * * *"); // daily, one batch of companies
  scheduleCron("ingest:ats", "30 */6 * * *"); // every 6 hours
  scheduleCron("cleanup:stale-jobs", "0 3 * * *"); // daily at 3am UTC
  // twice a day, after ingest; defaults maxJobs 300, maxLlmCalls 150
  scheduleCron("eligibility:check", "0 8,20 * * *");
}
