import { eq } from "drizzle-orm";
import { ArrowUpRight } from "lucide-react";
import { data, Form, Link, redirect, useNavigation } from "react-router";
import { VerdictBlock } from "~/components/verdict-block";
import { db, schema } from "~/db";
import { requireUser } from "~/lib/auth.server";
import { checkedInScopeJobs, LABEL_TARGET, saveLabel } from "~/lib/labels.server";
import { formatAge, formatCount, jobDate } from "~/lib/ui/format";
import { pickNext, stratifiedOrder } from "~/lib/ui/sampling";
import { parseVerdict, reasonForDisplay, verdictTone, verdictWord } from "~/lib/ui/verdict";
import type { Route } from "./+types/label";

export function meta() {
  return [{ title: "Label · jobradar" }];
}

function intParam(value: string | null | FormDataEntryValue): number {
  const n = Number(value);
  return Number.isInteger(n) && n >= 0 ? n : 0;
}

export async function loader({ request }: Route.LoaderArgs) {
  const url = new URL(request.url);
  const from = intParam(url.searchParams.get("from"));
  const doneId = intParam(url.searchParams.get("done"));

  const [candidates, labels] = await Promise.all([
    db
      .select({ id: schema.jobs.id, source: schema.jobs.source, verdict: schema.jobs.eligibility })
      .from(schema.jobs)
      .where(checkedInScopeJobs)
      .all(),
    db
      .select({ jobId: schema.eligibilityLabels.jobId, label: schema.eligibilityLabels.label })
      .from(schema.eligibilityLabels)
      .all(),
  ]);

  const labelled = new Set(labels.map((l) => l.jobId));
  const order = stratifiedOrder(candidates);
  const next = pickNext(order, labelled, from);

  // The posting to answer. The agent's verdict is deliberately NOT loaded, so
  // it cannot anchor the answer (it is not even in the page source).
  const current = next
    ? await db
        .select({
          id: schema.jobs.id,
          title: schema.jobs.title,
          company: schema.jobs.company,
          source: schema.jobs.source,
          location: schema.jobs.location,
          locations: schema.jobs.locations,
          workMode: schema.jobs.workMode,
          description: schema.jobs.description,
          postedAt: schema.jobs.postedAt,
          createdAt: schema.jobs.createdAt,
          sourceUrl: schema.jobs.sourceUrl,
          applyUrl: schema.jobs.applyUrl,
        })
        .from(schema.jobs)
        .where(eq(schema.jobs.id, next.item.id))
        .get()
    : null;

  // The posting just answered: now it is fine to reveal what the agent said.
  const doneLabel = doneId ? labels.find((l) => l.jobId === doneId) : undefined;
  const done =
    doneId && doneLabel
      ? await db
          .select({
            id: schema.jobs.id,
            title: schema.jobs.title,
            company: schema.jobs.company,
            eligibility: schema.jobs.eligibility,
            eligibilityEvidence: schema.jobs.eligibilityEvidence,
            eligibilityReason: schema.jobs.eligibilityReason,
            eligibilityBasis: schema.jobs.eligibilityBasis,
          })
          .from(schema.jobs)
          .where(eq(schema.jobs.id, doneId))
          .get()
      : null;

  return {
    current: current
      ? {
          ...current,
          locations: [
            ...new Set(
              current.locations?.length
                ? current.locations
                : current.location
                  ? [current.location]
                  : [],
            ),
          ],
        }
      : null,
    position: next?.position ?? 0,
    pool: order.length,
    labelled: labels.length,
    target: LABEL_TARGET,
    done:
      done && doneLabel
        ? {
            ...done,
            eligibilityReason: reasonForDisplay(done.eligibilityReason),
            userLabel: doneLabel.label,
          }
        : null,
    now: new Date().toISOString(),
  };
}

export async function action({ request }: Route.ActionArgs) {
  await requireUser(request);
  const form = await request.formData();
  const jobId = intParam(form.get("jobId"));
  const label = parseVerdict(form.get("label"));
  const from = intParam(form.get("from"));
  if (!jobId || !label) throw data("Bad request", { status: 400 });
  const exists = await db
    .select({ id: schema.jobs.id })
    .from(schema.jobs)
    .where(eq(schema.jobs.id, jobId))
    .get();
  if (!exists) throw data("Not found", { status: 404 });
  const note = form.get("note");
  await saveLabel(jobId, label, typeof note === "string" ? note : null);
  return redirect(`/label?from=${from}&done=${jobId}`);
}

function Reveal({ done }: { done: NonNullable<Route.ComponentProps["loaderData"]["done"]> }) {
  const agreed = done.userLabel === done.eligibility;
  return (
    <section className="jr-panel jr-reveal" aria-live="polite" aria-label="Last answer">
      <div className="jr-reveal__head">
        <span>
          You: <b>{verdictWord(done.userLabel)}</b> · Agent: <b>{verdictWord(done.eligibility)}</b>
        </span>
        <span className="jr-agree" data-ok={agreed}>
          {agreed ? "Agreed" : "Disagreed"}
        </span>
      </div>
      <p className="jr-sub" style={{ marginTop: 4, overflowWrap: "anywhere" }}>
        {done.title} · {done.company}
      </p>
      <VerdictBlock
        verdict={done.eligibility}
        evidence={done.eligibilityEvidence}
        reason={done.eligibilityReason}
        basis={done.eligibilityBasis}
      />
      <div className="jr-actions">
        <Link className="jr-btn" to={`/jobs/${done.id}`}>
          Change my answer
        </Link>
      </div>
    </section>
  );
}

const ANSWERS = [
  { value: "eligible", label: "Yes" },
  { value: "not_eligible", label: "No" },
  { value: "unclear", label: "Unclear" },
] as const;

export default function LabelPage({ loaderData }: Route.ComponentProps) {
  const { current, position, pool, labelled, target, done, now } = loaderData;
  const navigation = useNavigation();
  const busy = navigation.state === "submitting";
  const pct = Math.min(100, Math.round((labelled / target) * 100));

  return (
    <div className="jr-label-page">
      <h1 className="jr-h1">Label</h1>
      <p className="jr-sub">
        Read the posting, then answer from the posting alone. The agent's verdict shows after you
        answer.
      </p>
      <div className="jr-progress">
        <span>
          <b>{labelled}</b> / {target}
        </span>
        <span
          className="jr-bar"
          role="progressbar"
          aria-label="Labels saved"
          aria-valuemin={0}
          aria-valuemax={target}
          aria-valuenow={Math.min(labelled, target)}
        >
          <i style={{ width: `${pct}%` }} />
        </span>
        {current ? (
          <span title="Position in the sampling order">
            #{formatCount(position + 1)} of {formatCount(pool)}
          </span>
        ) : null}
      </div>

      {done ? <Reveal done={done} /> : null}

      {!current ? (
        <div className="jr-panel jr-empty" style={{ marginTop: 16 }}>
          <p>Every checked in-scope posting has a label. Nothing left to do here.</p>
        </div>
      ) : (
        <>
          <article className="jr-panel" style={{ marginTop: 16 }} key={current.id}>
            <div className="jr-meta">
              <span className="jr-meta__co">{current.company}</span>
              <span className="jr-src">{current.source}</span>
              <span>{formatAge(jobDate(current), now)}</span>
            </div>
            <h2 className="jr-card__title" style={{ marginTop: 6 }}>
              {current.title}
            </h2>
            <dl className="jr-kv">
              <dt>Location</dt>
              <dd>
                {current.locations.length === 0
                  ? "not listed"
                  : current.locations.map((loc) => (
                      <span key={loc} style={{ display: "block" }}>
                        {loc}
                      </span>
                    ))}
              </dd>
              <dt>Work mode</dt>
              <dd>{current.workMode ?? "not stated"}</dd>
            </dl>
            {current.description ? (
              <div className="jr-posting" style={{ marginTop: 16 }}>
                {current.description}
              </div>
            ) : (
              <p className="jr-sub">No description was stored for this posting.</p>
            )}
            {current.sourceUrl || current.applyUrl ? (
              <div className="jr-actions">
                <a
                  className="jr-btn"
                  href={current.sourceUrl || current.applyUrl || undefined}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  Original posting <ArrowUpRight aria-hidden="true" />
                  <span className="sr-only-jr"> (opens in a new tab)</span>
                </a>
              </div>
            ) : null}
            <label className="jr-label" htmlFor="label-note" style={{ marginTop: 16 }}>
              Note <span style={{ fontWeight: 400, color: "var(--ink-2)" }}>(optional)</span>
            </label>
            <textarea
              id="label-note"
              name="note"
              form="label-form"
              className="jr-textarea"
              rows={2}
              maxLength={1000}
              placeholder="Which line decided it?"
            />
          </article>

          <Form method="post" id="label-form" className="jr-dock" aria-label="Your answer">
            <input type="hidden" name="jobId" value={current.id} />
            <input type="hidden" name="from" value={position} />
            <p className="jr-dock__q">Can someone in India do this job remotely?</p>
            <div className="jr-dock__btns">
              {ANSWERS.map((a) => (
                <button
                  key={a.value}
                  type="submit"
                  name="label"
                  value={a.value}
                  className="jr-btn jr-answer"
                  data-v={verdictTone(a.value)}
                  disabled={busy}
                >
                  {a.label}
                </button>
              ))}
              <Link className="jr-btn jr-skipbtn" to={`/label?from=${position + 1}`}>
                Skip
              </Link>
            </div>
          </Form>
        </>
      )}
    </div>
  );
}
