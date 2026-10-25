import { eq } from "drizzle-orm";
import { ArrowDown, ArrowLeft, ArrowUpRight } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { data, Link, useFetcher } from "react-router";
import { postingUrl, SalaryLine } from "~/components/job-card";
import { VerdictBlock } from "~/components/verdict-block";
import { db, schema } from "~/db";
import { requireUser } from "~/lib/auth.server";
import { saveLabel } from "~/lib/labels.server";
import { type EvidencePlace, locateEvidence } from "~/lib/ui/evidence";
import { formatAge, formatDay, jobDate } from "~/lib/ui/format";
import { parseVerdict, verdictTone, verdictWord } from "~/lib/ui/verdict";
import type { Route } from "./+types/job";

export function meta({ data }: Route.MetaArgs) {
  return [{ title: data ? `${data.job.title} · ${data.job.company} · jobradar` : "jobradar" }];
}

function parseId(raw: string | undefined): number {
  const id = Number(raw);
  if (!Number.isInteger(id) || id <= 0) throw data("Not found", { status: 404 });
  return id;
}

export async function loader({ params }: Route.LoaderArgs) {
  const id = parseId(params.id);
  const [job, label] = await Promise.all([
    db.select().from(schema.jobs).where(eq(schema.jobs.id, id)).get(),
    db.select().from(schema.eligibilityLabels).where(eq(schema.eligibilityLabels.jobId, id)).get(),
  ]);
  if (!job) throw data("Not found", { status: 404 });

  const locations = [
    ...new Set(job.locations?.length ? job.locations : job.location ? [job.location] : []),
  ];
  const description = job.description ?? "";
  const place = locateEvidence(job.eligibilityEvidence, {
    title: job.title,
    locations,
    description,
  });

  return {
    job: {
      id: job.id,
      title: job.title,
      company: job.company,
      source: job.source,
      workMode: job.workMode,
      postedAt: job.postedAt,
      createdAt: job.createdAt,
      applyUrl: job.applyUrl,
      sourceUrl: job.sourceUrl,
      salaryMin: job.salaryMin,
      salaryMax: job.salaryMax,
      salaryCurrency: job.salaryCurrency,
      salaryText: job.salaryText,
      eligibility: job.eligibility,
      eligibilityEvidence: job.eligibilityEvidence,
      eligibilityReason: job.eligibilityReason,
      eligibilityMethod: job.eligibilityMethod,
      eligibilityCheckedAt: job.eligibilityCheckedAt,
    },
    locations,
    description,
    place,
    label: label ? { label: label.label, note: label.note, labelledAt: label.labelledAt } : null,
    now: new Date().toISOString(),
  };
}

export async function action({ request, params }: Route.ActionArgs) {
  await requireUser(request);
  const id = parseId(params.id);
  const form = await request.formData();
  const label = parseVerdict(form.get("label"));
  if (!label)
    return data({ ok: false as const, error: "Pick Yes, No or Unclear." }, { status: 400 });
  const exists = await db
    .select({ id: schema.jobs.id })
    .from(schema.jobs)
    .where(eq(schema.jobs.id, id))
    .get();
  if (!exists) throw data("Not found", { status: 404 });
  const note = form.get("note");
  await saveLabel(id, label, typeof note === "string" ? note : null);
  return { ok: true as const, label };
}

// The one hero motion (DESIGN §6): the evidence highlight sweeps in when it
// scrolls into view. Reduced motion, `?still`, or no IntersectionObserver ->
// drawn in full at once. Without JS the CSS draws it in full too.
function HeroMark({ children }: { children: React.ReactNode }) {
  const ref = useRef<HTMLElement>(null);
  const [on, setOn] = useState<"sweep" | "still" | null>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const reduce = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    const still = new URLSearchParams(window.location.search).has("still");
    if (reduce || still || !("IntersectionObserver" in window)) {
      setOn("still");
      return;
    }
    const io = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          setOn("sweep");
          io.disconnect();
        }
      },
      { threshold: 0.6 },
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);

  return (
    <mark ref={ref} id="evidence" className="jr-mark jr-mark--hero" data-on={on ?? undefined}>
      {children}
    </mark>
  );
}

function Marked({ text, range }: { text: string; range: { start: number; end: number } }) {
  return (
    <>
      {text.slice(0, range.start)}
      <mark className="jr-mark">{text.slice(range.start, range.end)}</mark>
      {text.slice(range.end)}
    </>
  );
}

function citeFor(place: EvidencePlace | null, hasEvidence: boolean): string | null {
  if (!hasEvidence) return null;
  if (!place) return "Quote not found in the stored posting text.";
  if (place.field === "title") return "Quoted from the job title.";
  if (place.field === "location") return "Quoted from the posting's location list.";
  return null;
}

const CHOICES = [
  { value: "eligible", label: "Yes" },
  { value: "not_eligible", label: "No" },
  { value: "unclear", label: "Unclear" },
] as const;

function VerdictWrong({ current }: { current: { label: string; note: string | null } | null }) {
  const fetcher = useFetcher<typeof action>();
  const busy = fetcher.state !== "idle";
  const result = fetcher.data;
  const saved = result?.ok ? result.label : (current?.label ?? null);

  return (
    <details className="jr-wrong" open={result !== undefined ? true : undefined}>
      <summary className="jr-btn jr-btn--ghost">
        {saved ? `Your label: ${verdictWord(saved)}. Change?` : "Verdict wrong?"}
      </summary>
      <fetcher.Form method="post" style={{ marginTop: 12 }}>
        <fieldset style={{ border: 0, padding: 0, margin: 0 }}>
          <legend className="jr-label">Can someone in India do this job remotely?</legend>
          <div className="jr-choice">
            {CHOICES.map((c) => (
              <label key={c.value}>
                <input
                  type="radio"
                  name="label"
                  value={c.value}
                  defaultChecked={saved === c.value}
                  required
                />
                <span data-v={verdictTone(c.value)}>{c.label}</span>
              </label>
            ))}
          </div>
        </fieldset>
        <label className="jr-label" htmlFor="label-note" style={{ marginTop: 12 }}>
          Note <span style={{ fontWeight: 400, color: "var(--ink-2)" }}>(optional)</span>
        </label>
        <textarea
          id="label-note"
          name="note"
          className="jr-textarea"
          rows={2}
          maxLength={1000}
          defaultValue={current?.note ?? ""}
          placeholder="Which line decided it for you?"
        />
        <div className="jr-actions">
          <button type="submit" className="jr-btn jr-btn--primary" disabled={busy}>
            {busy ? "Saving…" : "Save my answer"}
          </button>
        </div>
        <p
          className={`jr-status ${result?.ok ? "jr-status--ok" : result ? "jr-status--err" : ""}`}
          role="status"
          aria-live="polite"
        >
          {result?.ok
            ? `Saved: ${verdictWord(result.label)}. It is now an eval case.`
            : result && !result.ok
              ? result.error
              : ""}
        </p>
      </fetcher.Form>
    </details>
  );
}

export default function JobPage({ loaderData }: Route.ComponentProps) {
  const { job, locations, description, place, label, now } = loaderData;
  const url = postingUrl(job);
  const date = jobDate(job);
  const cite = citeFor(place, Boolean(job.eligibilityEvidence));

  return (
    <article>
      <Link to="/" className="jr-back">
        <ArrowLeft size={16} aria-hidden="true" /> Feed
      </Link>
      <div className="jr-meta">
        <span className="jr-meta__co">{job.company}</span>
        <span className="jr-src">{job.source}</span>
        <span>
          Posted {formatDay(date, now)}
          {formatAge(date, now) !== formatDay(date, now) ? ` · ${formatAge(date, now)}` : ""}
        </span>
      </div>
      <h1 className="jr-h1" style={{ marginTop: 6, overflowWrap: "anywhere" }}>
        {place?.field === "title" ? <Marked text={job.title} range={place.range} /> : job.title}
      </h1>
      <div style={{ marginTop: 8 }}>
        <SalaryLine job={job} />
      </div>
      {url ? (
        <div className="jr-actions">
          <a
            className="jr-btn jr-btn--primary"
            href={url}
            target="_blank"
            rel="noopener noreferrer"
          >
            Open posting <ArrowUpRight aria-hidden="true" />
            <span className="sr-only-jr"> (opens in a new tab)</span>
          </a>
        </div>
      ) : null}

      <div className="jr-detail">
        <div className="jr-detail__side">
          <section className="jr-panel" aria-label="Eligibility verdict">
            <VerdictBlock
              verdict={job.eligibility}
              evidence={job.eligibilityEvidence}
              reason={job.eligibilityReason}
              cite={cite}
            />
            <dl className="jr-kv">
              <dt>Decided by</dt>
              <dd>
                {job.eligibilityMethod === "llm"
                  ? "LLM + quote check"
                  : (job.eligibilityMethod ?? "—")}
              </dd>
              <dt>Checked</dt>
              <dd>
                {job.eligibilityCheckedAt ? formatDay(job.eligibilityCheckedAt, now) : "not yet"}
              </dd>
            </dl>
            {place?.field === "description" ? (
              <div className="jr-actions">
                <a className="jr-btn" href="#evidence">
                  Jump to the line <ArrowDown aria-hidden="true" />
                </a>
              </div>
            ) : null}
            <VerdictWrong current={label} />
          </section>
        </div>

        <section className="jr-panel jr-detail__posting" aria-label="Full posting">
          <h2 className="jr-posting-h">Posting</h2>
          <dl className="jr-kv" style={{ marginTop: 0, marginBottom: 16 }}>
            <dt>Location</dt>
            <dd>
              {locations.length === 0
                ? "not listed"
                : locations.map((loc, i) => (
                    <span key={loc} style={{ display: "block" }}>
                      {place?.field === "location" && place.index === i ? (
                        <Marked text={loc} range={place.range} />
                      ) : (
                        loc
                      )}
                    </span>
                  ))}
            </dd>
            <dt>Work mode</dt>
            <dd>{job.workMode ?? "not stated"}</dd>
          </dl>
          {description ? (
            <div className="jr-posting">
              {place?.field === "description" ? (
                <>
                  {description.slice(0, place.range.start)}
                  <HeroMark>{description.slice(place.range.start, place.range.end)}</HeroMark>
                  {description.slice(place.range.end)}
                </>
              ) : (
                description
              )}
            </div>
          ) : (
            <p className="jr-sub">No description was stored for this posting.</p>
          )}
        </section>
      </div>
    </article>
  );
}
