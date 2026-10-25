// Run one scheduler task from the shell, e.g.
//   pnpm task eligibility:check '{"maxJobs":400,"maxLlmCalls":40}'
// Uses the same ~/db fallback as the app: Turso when TURSO_DATABASE_URL is set, else the local file.
import { runTask } from "~/lib/scheduler";
import { registerScraperTasks } from "~/lib/scrapers";

const [name, rawPayload] = process.argv.slice(2);
if (!name) {
  console.error("usage: pnpm task <task-name> [json-payload]");
  process.exit(1);
}

registerScraperTasks();
const result = await runTask(name, rawPayload ? JSON.parse(rawPayload) : undefined);
console.log(JSON.stringify(result, null, 2));
