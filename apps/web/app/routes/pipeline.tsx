import { and, count, desc, eq } from "drizzle-orm";
import { Link } from "react-router";
import { SalaryLine } from "~/components/job-card";
import { StatusControl } from "~/components/save-button";
import { db, schema } from "~/db";
import { requireUser } from "~/lib/auth.server";
import { formatAge, formatCount } from "~/lib/ui/format";
import { parseSavedStatus, SAVED_STATUSES, type SavedStatus, STATUS_LABELS } from "~/lib/ui/saved";
import { verdictStamp, verdictTone } from "~/lib/ui/verdict";
import type { Route } from "./+types/pipeline";

export function meta() {
  return [{ title: "Saved · jobradar" }];
}

export async function loader({ request }: Route.LoaderArgs) {
  const user = await requireUser(request);
  const status = parseSavedStatus(new URL(request.url).searchParams.get("status"));
  const s = schema.savedJobs;
  const j = schema.jobs;
  const mine = eq(s.userId, user.id);

  const [items, byStatus] = await Promise.all([
    db
      .select({
        id: j.id,
        title: j.title,
        company: j.company,
        isActive: j.isActive,
        eligibility: j.eligibility,
        salaryMin: j.salaryMin,
        salaryMax: j.salaryMax,
        salaryCurrency: j.salaryCurrency,
        salaryText: j.salaryText,
        status: s.status,
        updatedAt: s.updatedAt,
      })
      .from(s)
      .innerJoin(j, eq(j.id, s.jobId))
      .where(status ? and(mine, eq(s.status, status)) : mine)
      .orderBy(desc(s.updatedAt), desc(s.id))
      .all(),
    db.select({ status: s.status, n: count() }).from(s).where(mine).groupBy(s.status).all(),
  ]);

  const counts = Object.fromEntries(byStatus.map((r) => [r.status, r.n])) as Partial<
    Record<SavedStatus, number>
  >;
  return {
    items: items.map((item) => ({ ...item, status: item.status as SavedStatus })),
    status,
    counts,
    total: byStatus.reduce((sum, r) => sum + r.n, 0),
    now: new Date().toISOString(),
  };
}

export default function PipelinePage({ loaderData }: Route.ComponentProps) {
  const { items, status, counts, total, now } = loaderData;
  const tabs: { key: SavedStatus | null; label: string; n: number }[] = [
    { key: null, label: "All", n: total },
    ...SAVED_STATUSES.map((s) => ({ key: s, label: STATUS_LABELS[s], n: counts[s] ?? 0 })),
  ];

  return (
    <div style={{ maxWidth: 760, margin: "0 auto" }}>
      <h1 className="jr-h1">Saved</h1>
      <p className="jr-sub">
        Jobs you saved, and how far each application got. You apply on the company's site; this only
        keeps track.
      </p>

      {total > 0 ? (
        <nav className="jr-pills" aria-label="Filter by status">
          {tabs.map((t) => (
            <Link
              key={t.key ?? "all"}
              to={t.key ? `/pipeline?status=${t.key}` : "/pipeline"}
              aria-current={status === t.key ? "true" : undefined}
              preventScrollReset
            >
              {t.label} <span className="jr-seg__n">{formatCount(t.n)}</span>
            </Link>
          ))}
        </nav>
      ) : null}

      {items.length === 0 ? (
        <div className="jr-panel jr-empty" style={{ marginTop: 16 }}>
          <p>
            {total === 0
              ? "Nothing saved yet. Tap Save on a job in the feed and it lands here."
              : `No jobs marked “${status ? STATUS_LABELS[status] : ""}”.`}
          </p>
          <p style={{ marginTop: 12 }}>
            <Link className="jr-btn" to={total === 0 ? "/" : "/pipeline"}>
              {total === 0 ? "Back to the feed" : "Show all saved"}
            </Link>
          </p>
        </div>
      ) : (
        <ul className="jr-saved">
          {items.map((item) => (
            <li key={item.id} className="jr-saved__item" data-v={verdictTone(item.eligibility)}>
              <div className="jr-saved__title">
                <Link to={`/jobs/${item.id}`}>{item.title}</Link>
              </div>
              <div className="jr-saved__meta">
                {[
                  item.company,
                  verdictStamp(item.eligibility),
                  `updated ${formatAge(item.updatedAt, now)}`,
                  item.isActive === false ? "posting closed" : null,
                ]
                  .filter(Boolean)
                  .join(" · ")}
              </div>
              <div style={{ marginTop: 6 }}>
                <SalaryLine job={item} />
              </div>
              <StatusControl jobId={item.id} status={item.status} />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
