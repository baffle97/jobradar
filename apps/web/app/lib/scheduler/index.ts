import { Cron } from "croner";
import { eq } from "drizzle-orm";
import { db, schema } from "~/db";

type TaskFn = (payload?: unknown) => Promise<unknown>;

const registry = new Map<string, TaskFn>();
const activeCrons: Cron[] = [];

export function defineTask(name: string, fn: TaskFn) {
  registry.set(name, fn);
}

export async function runTask(name: string, payload?: unknown) {
  const fn = registry.get(name);
  if (!fn) throw new Error(`Task "${name}" not registered`);

  const [run] = db
    .insert(schema.taskRuns)
    .values({ taskName: name, status: "running", payload, startedAt: new Date().toISOString() })
    .returning()
    .all();

  try {
    const result = await fn(payload);
    db.update(schema.taskRuns)
      .set({ status: "completed", result, completedAt: new Date().toISOString() })
      .where(eq(schema.taskRuns.id, run.id))
      .run();
    console.log(`[scheduler] ${name} completed`);
    return result;
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    db.update(schema.taskRuns)
      .set({ status: "failed", error: message, completedAt: new Date().toISOString() })
      .where(eq(schema.taskRuns.id, run.id))
      .run();
    console.error(`[scheduler] ${name} failed:`, message);
    throw err;
  }
}

export function scheduleCron(name: string, cronExpr: string, payload?: unknown) {
  const job = new Cron(cronExpr, { name }, async () => {
    try {
      await runTask(name, payload);
    } catch {
      // logged in runTask
    }
  });
  activeCrons.push(job);
  console.log(`[scheduler] scheduled "${name}" with cron: ${cronExpr}`);
  return job;
}

export function stopAll() {
  for (const job of activeCrons) {
    job.stop();
  }
  activeCrons.length = 0;
}
