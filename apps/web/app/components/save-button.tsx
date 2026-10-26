import { Bookmark, BookmarkCheck } from "lucide-react";
import { useFetcher, useLocation } from "react-router";
import { parseSavedStatus, SAVED_STATUSES, type SavedStatus, STATUS_LABELS } from "~/lib/ui/saved";
import type { action } from "~/routes/save";
import { useHydrated } from "./use-hydrated";

// The status a save form is about to write, while it is in flight; undefined
// when nothing is pending.
function pendingStatus(formData: FormData | undefined): SavedStatus | null | undefined {
  const raw = formData?.get("status");
  if (raw == null) return undefined;
  return raw === "remove" ? null : parseSavedStatus(raw);
}

// Fields every save form carries: which job, where a no-JS post goes back to,
// and js=1 once hydrated so the action answers the fetcher with JSON.
function SaveFields({ jobId, anchor }: { jobId: number; anchor?: string }) {
  const hydrated = useHydrated();
  const { pathname, search } = useLocation();
  return (
    <>
      <input type="hidden" name="jobId" value={jobId} />
      <input type="hidden" name="returnTo" value={`${pathname}${search}${anchor ?? ""}`} />
      {hydrated ? <input type="hidden" name="js" value="1" /> : null}
    </>
  );
}

// One-tap Save / Saved toggle for the feed cards.
export function SaveButton({ jobId, status }: { jobId: number; status: SavedStatus | null }) {
  const fetcher = useFetcher<typeof action>();
  const pending = pendingStatus(fetcher.formData);
  const current = pending === undefined ? status : pending;
  return (
    <fetcher.Form method="post" action="/save" className="jr-saveform">
      <SaveFields jobId={jobId} anchor={`#job-${jobId}`} />
      <input type="hidden" name="status" value={current ? "remove" : "saved"} />
      <button type="submit" className="jr-btn" aria-pressed={current ? "true" : "false"}>
        {current ? <BookmarkCheck aria-hidden="true" /> : <Bookmark aria-hidden="true" />}
        {current ? STATUS_LABELS[current] : "Save"}
        {current ? <span className="sr-only-jr"> (tap to unsave)</span> : null}
      </button>
    </fetcher.Form>
  );
}

// Save button, then a status picker once saved: the job page and /pipeline.
export function StatusControl({
  jobId,
  status,
  label = "Status",
}: {
  jobId: number;
  status: SavedStatus | null;
  label?: string;
}) {
  const fetcher = useFetcher<typeof action>();
  const hydrated = useHydrated();
  const pending = pendingStatus(fetcher.formData);
  const current = pending === undefined ? status : pending;

  if (!current) {
    return (
      <fetcher.Form method="post" action="/save" className="jr-saveform">
        <SaveFields jobId={jobId} />
        <input type="hidden" name="status" value="saved" />
        <button type="submit" className="jr-btn" aria-pressed="false">
          <Bookmark aria-hidden="true" /> Save
        </button>
      </fetcher.Form>
    );
  }

  return (
    <div className="jr-status-ctl">
      <fetcher.Form
        method="post"
        action="/save"
        className="jr-status-ctl__form"
        // With JS a new choice is saved at once; without it, the Update button posts it.
        onChange={(e) => fetcher.submit(e.currentTarget)}
      >
        <SaveFields jobId={jobId} />
        <label className="jr-field">
          <span className="jr-label">{label}</span>
          <select className="jr-select" name="status" defaultValue={current} key={current}>
            {SAVED_STATUSES.map((s) => (
              <option key={s} value={s}>
                {STATUS_LABELS[s]}
              </option>
            ))}
          </select>
        </label>
        {hydrated ? null : (
          <button type="submit" className="jr-btn">
            Update
          </button>
        )}
      </fetcher.Form>
      <fetcher.Form method="post" action="/save" className="jr-saveform">
        <SaveFields jobId={jobId} />
        <input type="hidden" name="status" value="remove" />
        <button type="submit" className="jr-btn jr-btn--ghost">
          Remove
        </button>
      </fetcher.Form>
    </div>
  );
}
