// POST /save: save, move or unsave a job for the signed-in user. Posted by the
// Save buttons (lib/ui/saved.ts has the statuses). With JS the fetcher gets
// JSON back; a plain form post is sent back to the page it came from.
import { eq } from "drizzle-orm";
import { data, redirect } from "react-router";
import { db, schema } from "~/db";
import { requireUser } from "~/lib/auth.server";
import { setSaved } from "~/lib/saved.server";
import { parseSavedStatus, type SavedStatus, safeReturnTo } from "~/lib/ui/saved";
import type { Route } from "./+types/save";

export async function action({ request }: Route.ActionArgs) {
  const user = await requireUser(request);
  const form = await request.formData();
  const jobId = Number(form.get("jobId"));
  const raw = form.get("status");
  const status: SavedStatus | null = raw === "remove" ? null : parseSavedStatus(raw);
  if (!Number.isInteger(jobId) || jobId <= 0 || (raw !== "remove" && !status)) {
    return data({ ok: false as const, error: "Bad request." }, { status: 400 });
  }
  const job = await db
    .select({ id: schema.jobs.id })
    .from(schema.jobs)
    .where(eq(schema.jobs.id, jobId))
    .get();
  if (!job) return data({ ok: false as const, error: "No such job." }, { status: 404 });

  await setSaved(user.id, jobId, status);
  if (form.get("js") !== "1") throw redirect(safeReturnTo(form.get("returnTo")));
  return { ok: true as const, jobId, status };
}

export function loader() {
  return redirect("/pipeline");
}
