import { isAuthorized } from "~/lib/auth.server";
import { runTask } from "~/lib/scheduler";
import type { Route } from "./+types/api.scrape";

const VALID_TASKS = [
  "scrape:all",
  "scrape:adzuna",
  "scrape:remotive",
  "scrape:hn",
  "ingest:ats",
  "discover:yc",
  "cleanup:stale-jobs",
];

// Scrapes can run for minutes; 300s is the Hobby plan ceiling.
export const config = { maxDuration: 300 };

export async function action({ request }: Route.ActionArgs) {
  if (!(await isAuthorized(request))) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const formData = await request.formData();
  const task = formData.get("task") as string;

  if (!VALID_TASKS.includes(task)) {
    return Response.json({ error: `Invalid task: ${task}` }, { status: 400 });
  }

  try {
    const result = await runTask(task);
    return Response.json({ ok: true, task, result });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return Response.json({ error: message }, { status: 500 });
  }
}
