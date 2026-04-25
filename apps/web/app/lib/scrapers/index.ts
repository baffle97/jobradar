import { defineTask, scheduleCron } from "~/lib/scheduler";
import { scrapeAdzuna } from "./adzuna";
import { cleanupStaleJobs } from "./cleanup";
import { scrapeHN } from "./hn";
import { scrapeJSearch } from "./jsearch";
import { scrapeRemotive } from "./remotive";

async function scrapeAll() {
  const results: Record<string, unknown> = {};
  for (const [name, fn] of [
    ["adzuna", scrapeAdzuna],
    ["remotive", scrapeRemotive],
    ["jsearch", scrapeJSearch],
    ["hn", scrapeHN],
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
  defineTask("scrape:jsearch", scrapeJSearch);
  defineTask("scrape:hn", scrapeHN);
  defineTask("cleanup:stale-jobs", cleanupStaleJobs);
}

export function scheduleScraperCrons() {
  scheduleCron("scrape:adzuna", "0 */4 * * *"); // every 4 hours
  scheduleCron("scrape:remotive", "0 */6 * * *"); // every 6 hours
  scheduleCron("scrape:jsearch", "0 8,20 * * *"); // twice daily
  scheduleCron("scrape:hn", "0 12 1,15 * *"); // 1st and 15th of month
  scheduleCron("cleanup:stale-jobs", "0 3 * * *"); // daily at 3am UTC
}
