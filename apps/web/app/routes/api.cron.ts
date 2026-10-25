import { hasCronSecret } from "~/lib/auth.server";
import { hasTask, runTask } from "~/lib/scheduler";
import type { Route } from "./+types/api.cron";

// Each Vercel Cron invocation is one function call, so tasks must finish inside it.
export const config = { maxDuration: 300 };

// Vercel Cron calls GET /api/cron/<task>; numeric query params become the task payload,
// e.g. /api/cron/ingest:ats?maxBoards=100.
export async function loader({ request, params }: Route.LoaderArgs) {
  if (!hasCronSecret(request)) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const task = params.task;
  if (!hasTask(task)) {
    return Response.json({ error: `Unknown task: ${task}` }, { status: 404 });
  }

  const numbers = [...new URL(request.url).searchParams]
    .map(([key, value]) => [key, Number(value)] as const)
    .filter(([, value]) => Number.isFinite(value));
  const payload = numbers.length ? Object.fromEntries(numbers) : undefined;

  try {
    const result = await runTask(task, payload);
    return Response.json({ ok: true, task, result });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return Response.json({ error: message }, { status: 500 });
  }
}
