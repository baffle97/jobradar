import { and, count, desc, eq, inArray, type SQL, sql } from "drizzle-orm";
import { Search } from "lucide-react";
import { Form, Link } from "react-router";
import { JobCard } from "~/components/job-card";
import { db, schema } from "~/db";
import { countLabels, inScopeJobs, LABEL_TARGET } from "~/lib/labels.server";
import { formatCount, formatDay } from "~/lib/ui/format";
import { type FeedFilter, parseFeedFilter } from "~/lib/ui/verdict";
import type { Route } from "./+types/feed";

const STEP = 20;
const MAX_SHOWN = 400;

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
  const url = new URL(request.url);
  const filter = parseFeedFilter(url.searchParams.get("v"));
  const q = (url.searchParams.get("q") ?? "").trim().slice(0, 100);
  const shown = Math.min(MAX_SHOWN, Math.max(STEP, Number(url.searchParams.get("n")) || STEP));

  const j = schema.jobs;
  const conditions: (SQL | undefined)[] = [inScopeJobs, filterCondition(filter)];
  if (q) {
    const like = `%${q}%`;
    conditions.push(sql`(${j.title} LIKE ${like} OR ${j.company} LIKE ${like})`);
  }
  const where = and(...conditions);

  // Eligible first, then unclear, then no; newest posting first inside each group.
  const verdictRank = sql`CASE ${j.eligibility} WHEN 'eligible' THEN 0 WHEN 'unclear' THEN 1 WHEN 'not_eligible' THEN 2 ELSE 3 END`;
  const postedAt = sql`COALESCE(julianday(${j.postedAt}), julianday(${j.createdAt}))`;

  const [jobs, [{ total }], byVerdict, labelled] = await Promise.all([
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
      })
      .from(j)
      .where(where)
      .orderBy(verdictRank, desc(postedAt), desc(j.id))
      .limit(shown)
      .all(),
    db.select({ total: count() }).from(j).where(where).all(),
    db
      .select({ verdict: j.eligibility, n: count() })
      .from(j)
      .where(inScopeJobs)
      .groupBy(j.eligibility)
      .all(),
    countLabels(),
  ]);

  const counts = { eligible: 0, unclear: 0, not_eligible: 0, all: 0 };
  for (const row of byVerdict) {
    counts.all += row.n;
    if (row.verdict === "eligible" || row.verdict === "unclear" || row.verdict === "not_eligible") {
      counts[row.verdict] += row.n;
    }
  }

  return {
    jobs,
    total,
    shown,
    filter,
    q,
    counts,
    labelled,
    labelTarget: LABEL_TARGET,
    // One "now" for server and browser, so ages render identically on both.
    now: new Date().toISOString(),
  };
}

function feedHref(params: { v?: FeedFilter; q?: string; n?: number }) {
  const sp = new URLSearchParams();
  if (params.v && params.v !== "open") sp.set("v", params.v);
  if (params.q) sp.set("q", params.q);
  if (params.n && params.n > STEP) sp.set("n", String(params.n));
  const s = sp.toString();
  return s ? `/?${s}` : "/";
}

export default function FeedPage({ loaderData }: Route.ComponentProps) {
  const { jobs, total, shown, filter, q, counts, labelled, labelTarget, now } = loaderData;

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
            <b>{formatCount(counts.all)}</b> in-scope remote
          </span>
          <span aria-hidden="true">·</span>
          <span>
            <b>{formatCount(counts.eligible)}</b> eligible
          </span>
          <span aria-hidden="true">·</span>
          <span>
            <b>{formatCount(counts.unclear)}</b> unclear
          </span>
        </p>

        <nav className="jr-seg" aria-label="Filter by verdict">
          {segments.map((s) => (
            <Link
              key={s.v}
              to={feedHref({ v: s.v, q })}
              aria-current={filter === s.v ? "true" : undefined}
              preventScrollReset
            >
              {s.label} <span className="jr-seg__n">{formatCount(s.n)}</span>
            </Link>
          ))}
        </nav>

        <Form method="get" action="/" className="jr-search" role="search">
          {filter !== "open" ? <input type="hidden" name="v" value={filter} /> : null}
          <label htmlFor="feed-q" className="sr-only-jr">
            Search title or company
          </label>
          <input
            id="feed-q"
            className="jr-input"
            type="search"
            name="q"
            defaultValue={q}
            key={q}
            placeholder="Search title or company"
            autoComplete="off"
            enterKeyHint="search"
          />
          <button type="submit" className="jr-btn jr-btn--icon" aria-label="Search">
            <Search aria-hidden="true" />
          </button>
        </Form>

        {jobs.length === 0 ? (
          <div className="jr-panel jr-empty jr-cards">
            <p>{q ? `Nothing matches “${q}” here.` : "No postings in this view yet."}</p>
            {q ? (
              <p style={{ marginTop: 12 }}>
                <Link className="jr-btn" to={feedHref({ v: filter })}>
                  Clear search
                </Link>
              </p>
            ) : null}
          </div>
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
          {jobs.length < total && shown < MAX_SHOWN ? (
            <Link
              className="jr-btn"
              to={feedHref({ v: filter, q, n: shown + STEP })}
              preventScrollReset
            >
              Load more
            </Link>
          ) : null}
          {jobs.length < total && shown >= MAX_SHOWN ? (
            <span>Narrow it down with search to see the rest.</span>
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
