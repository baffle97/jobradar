import { and, count, desc, eq, inArray, type SQL, sql } from "drizzle-orm";
import { Search, X } from "lucide-react";
import { Form, Link, redirect } from "react-router";
import { JobCard, JobRow } from "~/components/job-card";
import { useHydrated } from "~/components/use-hydrated";
import { db, schema } from "~/db";
import { requireUser } from "~/lib/auth.server";
import { narrowingConditions, notFromHints, postedAtSql } from "~/lib/feed.server";
import { countLabels, inScopeJobs, LABEL_TARGET } from "~/lib/labels.server";
import {
  AGE_LABELS,
  AGES,
  activeFilters,
  basisApplies,
  cleanFeedHref,
  clearFiltersHref,
  type FeedParams,
  feedHref,
  feedStep,
  MAX_SHOWN,
  parseFeedParams,
  SOURCE_LABELS,
  SOURCES,
} from "~/lib/ui/feed-params";
import { formatCount, formatDay } from "~/lib/ui/format";
import { MIN_PAY, RATES_DATE } from "~/lib/ui/pay";
import { ROLE_KEYS, roleLabel } from "~/lib/ui/roles";
import type { SavedStatus } from "~/lib/ui/saved";
import { type FeedFilter, reasonForDisplay } from "~/lib/ui/verdict";
import type { Route } from "./+types/feed";

export function meta() {
  return [{ title: "Feed · jobradar" }];
}

function filterCondition(filter: FeedFilter): SQL | undefined {
  const e = schema.jobs.eligibility;
  switch (filter) {
    case "open":
      return inArray(e, ["eligible", "unclear"]);
    case "eligible":
      return eq(e, "eligible");
    case "not_eligible":
      return eq(e, "not_eligible");
    default:
      return undefined;
  }
}

export async function loader({ request }: Route.LoaderArgs) {
  const { searchParams } = new URL(request.url);
  // One URL per view: drop empty/default params (the no-JS form sends them).
  const clean = cleanFeedHref(searchParams);
  if (clean) throw redirect(clean);
  const user = await requireUser(request);
  const params = parseFeedParams(searchParams);
  const j = schema.jobs;
  const narrowing = [inScopeJobs, ...narrowingConditions(params)];
  const where = and(
    ...narrowing,
    filterCondition(params.v),
    params.basis ? notFromHints : undefined,
  );

  // best: eligible first, then unclear, then no; newest posting first inside
  // each group. new: newest first.
  const verdictRank = sql`CASE ${j.eligibility} WHEN 'eligible' THEN 0 WHEN 'unclear' THEN 1 WHEN 'not_eligible' THEN 2 ELSE 3 END`;
  const order =
    params.sort === "new"
      ? [desc(postedAtSql), desc(j.id)]
      : [verdictRank, desc(postedAtSql), desc(j.id)];

  const [jobs, [{ total }], byVerdict, global, labelled] = await Promise.all([
    db
      .select({
        id: j.id,
        title: j.title,
        company: j.company,
        source: j.source,
        location: j.location,
        workMode: j.workMode,
        postedAt: j.postedAt,
        createdAt: j.createdAt,
        applyUrl: j.applyUrl,
        sourceUrl: j.sourceUrl,
        salaryMin: j.salaryMin,
        salaryMax: j.salaryMax,
        salaryCurrency: j.salaryCurrency,
        salaryText: j.salaryText,
        eligibility: j.eligibility,
        eligibilityEvidence: j.eligibilityEvidence,
        eligibilityReason: j.eligibilityReason,
        eligibilityBasis: j.eligibilityBasis,
        saved: schema.savedJobs.status,
      })
      .from(j)
      .leftJoin(
        schema.savedJobs,
        and(eq(schema.savedJobs.jobId, j.id), eq(schema.savedJobs.userId, user.id)),
      )
      .where(where)
      .orderBy(...order)
      .limit(params.n)
      .all(),
    db.select({ total: count() }).from(j).where(where).all(),
    // Segment counts under the same role/age/src/pay/q, so they match the list.
    db
      .select({
        verdict: j.eligibility,
        n: count(),
        fromHints: sql<number>`SUM(CASE WHEN ${j.eligibilityBasis} = 'hints' THEN 1 ELSE 0 END)`,
      })
      .from(j)
      .where(and(...narrowing))
      .groupBy(j.eligibility)
      .all(),
    // The funnel line stays global.
    db
      .select({ verdict: j.eligibility, n: count() })
      .from(j)
      .where(inScopeJobs)
      .groupBy(j.eligibility)
      .all(),
    countLabels(),
  ]);

  const tally = (rows: { verdict: string | null; n: number; fromHints?: number }[]) => {
    const c = { eligible: 0, unclear: 0, not_eligible: 0, all: 0 };
    for (const row of rows) {
      c.all += row.n;
      if (
        row.verdict === "eligible" ||
        row.verdict === "unclear" ||
        row.verdict === "not_eligible"
      ) {
        // basis=explicit applies to the eligible and open segments only.
        const hidden = params.basis && row.verdict === "eligible" ? Number(row.fromHints ?? 0) : 0;
        c[row.verdict] += row.n - hidden;
      }
    }
    return c;
  };

  return {
    jobs: jobs.map((job) => ({
      ...job,
      eligibilityReason: reasonForDisplay(job.eligibilityReason),
      saved: job.saved as SavedStatus | null,
    })),
    total,
    params,
    counts: tally(byVerdict),
    funnel: tally(global),
    labelled,
    labelTarget: LABEL_TARGET,
    // One "now" for server and browser, so ages render identically on both.
    now: new Date().toISOString(),
  };
}

// Hidden inputs that carry every param of `href` through a GET form.
function HiddenParams({ href }: { href: string }) {
  const sp = new URLSearchParams(href.split("?")[1] ?? "");
  return (
    <>
      {[...sp].map(([name, value]) => (
        <input key={name} type="hidden" name={name} value={value} />
      ))}
    </>
  );
}

function FilterPanel({ params }: { params: FeedParams }) {
  const active = activeFilters(params).length;
  return (
    <details className="jr-filters">
      <summary className="jr-btn">Filters{active ? ` · ${active}` : ""}</summary>
      <Form method="get" action="/" className="jr-filters__form">
        {/* v, q and view ride along; the fields below replace the rest. */}
        <HiddenParams
          href={feedHref(params, {
            role: null,
            age: null,
            src: null,
            pay: false,
            min: null,
            basis: null,
            sort: "best",
          })}
        />
        <div className="jr-filters__grid">
          <label className="jr-field">
            <span className="jr-label">Role</span>
            <select className="jr-select" name="role" defaultValue={params.role ?? ""}>
              <option value="">Any role</option>
              {ROLE_KEYS.map((k) => (
                <option key={k} value={k}>
                  {roleLabel(k)}
                </option>
              ))}
            </select>
          </label>
          <label className="jr-field">
            <span className="jr-label">Posted</span>
            <select className="jr-select" name="age" defaultValue={params.age ?? ""}>
              <option value="">Any time</option>
              {AGES.map((a) => (
                <option key={a} value={a}>
                  {AGE_LABELS[a]}
                </option>
              ))}
            </select>
          </label>
          <label className="jr-field">
            <span className="jr-label">Source</span>
            <select className="jr-select" name="src" defaultValue={params.src ?? ""}>
              <option value="">All sources</option>
              {SOURCES.map((s) => (
                <option key={s} value={s}>
                  {SOURCE_LABELS[s]}
                </option>
              ))}
            </select>
          </label>
          <label className="jr-field">
            <span className="jr-label">Pay (top of range)</span>
            <select className="jr-select" name="min" defaultValue={params.min ?? ""}>
              <option value="">Any pay</option>
              {MIN_PAY.map((m) => (
                <option key={m} value={m}>
                  ₹{m}L+ a month
                </option>
              ))}
            </select>
          </label>
          <label className="jr-field">
            <span className="jr-label">Sort</span>
            <select className="jr-select" name="sort" defaultValue={params.sort}>
              <option value="best">Eligible first</option>
              <option value="new">Newest first</option>
            </select>
          </label>
        </div>
        <label className="jr-check">
          <input type="checkbox" name="pay" value="1" defaultChecked={params.pay} />
          Salary listed
        </label>
        <p className="jr-hint">
          Pay is the top of the posted range in rupees, at{" "}
          <a href="https://www.frankfurter.app/" target="_blank" rel="noopener noreferrer">
            ECB rates
          </a>{" "}
          of {RATES_DATE}. Most ranges are written for the US or Europe; an India hire may be
          offered less. Jobs with no figure are hidden by this filter.
        </p>
        {basisApplies(params.v) ? (
          <label className="jr-check">
            <input
              type="checkbox"
              name="basis"
              value="explicit"
              defaultChecked={params.basis === "explicit"}
            />
            Only verdicts on an explicit line (hide “from hints”)
          </label>
        ) : null}
        <div className="jr-actions">
          <button type="submit" className="jr-btn jr-btn--primary">
            Apply
          </button>
        </div>
      </Form>
    </details>
  );
}

export default function FeedPage({ loaderData }: Route.ComponentProps) {
  const { jobs, total, params, counts, funnel, labelled, labelTarget, now } = loaderData;
  const hydrated = useHydrated();
  const step = feedStep(params.view);
  const chips = activeFilters(params);
  // Without JS, "Load more" is a full page load that starts at the top; the hash
  // brings the reader back to the last row they saw, new ones right below it.
  // With JS, preventScrollReset already keeps the place.
  const lastId = jobs.at(-1)?.id;
  const moreHash = !hydrated && lastId ? `#job-${lastId}` : "";

  const segments: { v: FeedFilter; label: string; n: number }[] = [
    { v: "open", label: "Eligible + unclear", n: counts.eligible + counts.unclear },
    { v: "eligible", label: "Eligible", n: counts.eligible },
    { v: "not_eligible", label: "Not eligible", n: counts.not_eligible },
    { v: "all", label: "All", n: counts.all },
  ];

  return (
    <div className="jr-feed">
      <div style={{ minWidth: 0 }}>
        <h1 className="jr-h1">Today, {formatDay(now, now)}</h1>
        <p className="jr-sub">Remote roles, sorted by whether you can take them from India.</p>
        <p className="jr-funnel">
          <span>
            <b>{formatCount(funnel.all)}</b> in-scope remote
          </span>
          <span aria-hidden="true">·</span>
          <span>
            <b>{formatCount(funnel.eligible)}</b> eligible
          </span>
          <span aria-hidden="true">·</span>
          <span>
            <b>{formatCount(funnel.unclear)}</b> unclear
          </span>
        </p>

        <nav className="jr-seg" aria-label="Filter by verdict">
          {segments.map((s) => (
            <Link
              key={s.v}
              to={feedHref(params, { v: s.v })}
              aria-current={params.v === s.v ? "true" : undefined}
              preventScrollReset
            >
              {s.label} <span className="jr-seg__n">{formatCount(s.n)}</span>
            </Link>
          ))}
        </nav>

        <Form method="get" action="/" className="jr-search" role="search">
          <HiddenParams href={feedHref(params, { q: "" })} />
          <label htmlFor="feed-q" className="sr-only-jr">
            Search title or company
          </label>
          <input
            id="feed-q"
            className="jr-input"
            type="search"
            name="q"
            defaultValue={params.q}
            key={params.q}
            placeholder="Search title or company"
            autoComplete="off"
            enterKeyHint="search"
          />
          <button type="submit" className="jr-btn jr-btn--icon" aria-label="Search">
            <Search aria-hidden="true" />
          </button>
        </Form>

        <FilterPanel key={feedHref(params)} params={params} />

        {chips.length ? (
          <ul className="jr-chips" aria-label="Active filters">
            {chips.map((c) => (
              <li key={c.key}>
                <Link className="jr-chip" to={c.href} preventScrollReset>
                  {c.label}
                  <X aria-hidden="true" />
                  <span className="sr-only-jr"> (remove filter)</span>
                </Link>
              </li>
            ))}
            {chips.length >= 2 ? (
              <li>
                <Link className="jr-chip jr-chip--clear" to={clearFiltersHref(params)}>
                  Clear all
                </Link>
              </li>
            ) : null}
          </ul>
        ) : null}

        <div className="jr-resultbar">
          <span className="mono">
            {formatCount(total)} {total === 1 ? "job" : "jobs"}
          </span>
          <nav className="jr-toggle" aria-label="Layout">
            <Link
              to={feedHref(params, { view: "cards" })}
              aria-current={params.view === "cards" ? "true" : undefined}
              preventScrollReset
            >
              Cards
            </Link>
            <Link
              to={feedHref(params, { view: "list" })}
              aria-current={params.view === "list" ? "true" : undefined}
              preventScrollReset
            >
              List
            </Link>
          </nav>
        </div>

        {jobs.length === 0 ? (
          <div className="jr-panel jr-empty jr-cards">
            <p>
              {params.q ? `Nothing matches “${params.q}” here.` : "No postings in this view yet."}
            </p>
            {params.q || chips.length ? (
              <p className="jr-actions" style={{ justifyContent: "center" }}>
                {params.q ? (
                  <Link className="jr-btn" to={feedHref(params, { q: "" })}>
                    Clear search
                  </Link>
                ) : null}
                {chips.length ? (
                  <Link className="jr-btn" to={clearFiltersHref(params)}>
                    Clear filters
                  </Link>
                ) : null}
              </p>
            ) : null}
          </div>
        ) : params.view === "list" ? (
          <ul className="jr-rows">
            {jobs.map((job) => (
              <JobRow key={job.id} job={job} now={now} />
            ))}
          </ul>
        ) : (
          <div className="jr-cards">
            {jobs.map((job) => (
              <JobCard key={job.id} job={job} now={now} />
            ))}
          </div>
        )}

        <div className="jr-more">
          {jobs.length > 0 ? (
            <span className="mono">
              Showing {formatCount(jobs.length)} of {formatCount(total)}
            </span>
          ) : null}
          {jobs.length < total && params.n < MAX_SHOWN ? (
            <Link
              className="jr-btn"
              to={`${feedHref(params, { n: params.n + step })}${moreHash}`}
              preventScrollReset
            >
              Load more
            </Link>
          ) : null}
          {jobs.length < total && params.n >= MAX_SHOWN ? (
            <span>Narrow it down with search or filters to see the rest.</span>
          ) : null}
        </div>
      </div>

      <aside className="jr-rail" aria-label="About this feed">
        <div className="jr-panel">
          <h2>Why so few?</h2>
          <p>
            Most “remote” jobs are remote inside one country. Every verdict quotes the line it rests
            on, so you can check it in two seconds.
          </p>
        </div>
        <div className="jr-panel">
          <h2>Hand labels for the eval</h2>
          <p className="mono" style={{ color: "var(--ink)" }}>
            {labelled} / {labelTarget}
          </p>
          <p style={{ marginTop: 6 }}>
            Your answers are the ground truth the agent is scored against.
          </p>
          <p style={{ marginTop: 12 }}>
            <Link className="jr-btn" to="/label">
              Label postings
            </Link>
          </p>
        </div>
      </aside>
    </div>
  );
}
