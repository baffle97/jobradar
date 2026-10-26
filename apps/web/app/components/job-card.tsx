import { Card } from "@heroui/react";
import { ArrowUpRight, BookmarkCheck } from "lucide-react";
import { Link } from "react-router";
import { formatAge, isNew, jobDate } from "~/lib/ui/format";
import { formatInrPerMonth, inrPerMonth } from "~/lib/ui/pay";
import { formatSalary, type SalaryLike } from "~/lib/ui/salary";
import { type SavedStatus, STATUS_LABELS } from "~/lib/ui/saved";
import { verdictStamp, verdictTone } from "~/lib/ui/verdict";
import { SaveButton } from "./save-button";
import { VerdictBlock } from "./verdict-block";

export interface FeedJob extends SalaryLike {
  id: number;
  title: string;
  company: string;
  source: string;
  location: string | null;
  workMode: string | null;
  postedAt: string | null;
  createdAt: string;
  applyUrl: string | null;
  sourceUrl: string | null;
  eligibility: string | null;
  eligibilityEvidence: string | null;
  eligibilityReason: string | null;
  eligibilityBasis: string | null;
  // This user's saved status; null when not saved.
  saved: SavedStatus | null;
}

export function postingUrl(job: { applyUrl: string | null; sourceUrl: string | null }) {
  return job.sourceUrl || job.applyUrl || null;
}

export function SalaryLine({ job }: { job: SalaryLike }) {
  const salary = formatSalary(job);
  if (!salary) return <div className="jr-salary jr-salary--none">Salary not listed</div>;
  const inr = inrPerMonth(job);
  return (
    <div className="jr-salary">
      {salary.text} <span className="jr-tag">{salary.context}</span>
      {inr ? (
        <span className="jr-tag" title="Top of the range in rupees a month">
          {formatInrPerMonth(inr)}
        </span>
      ) : null}
    </div>
  );
}

export function JobMeta({ job, now }: { job: FeedJob; now: string }) {
  const date = jobDate(job);
  return (
    <div className="jr-meta">
      <span className="jr-meta__co">{job.company}</span>
      <span className="jr-src">{job.source}</span>
      <span>{formatAge(date, now)}</span>
      {isNew(date, now) ? <span className="jr-new">New</span> : null}
    </div>
  );
}

export function JobCard({ job, now }: { job: FeedJob; now: string }) {
  const url = postingUrl(job);
  return (
    <Card id={`job-${job.id}`} className="jr-card" data-v={verdictTone(job.eligibility)}>
      <JobMeta job={job} now={now} />
      <h2 className="jr-card__title">
        <Link to={`/jobs/${job.id}`}>{job.title}</Link>
      </h2>
      <SalaryLine job={job} />
      <VerdictBlock
        verdict={job.eligibility}
        evidence={job.eligibilityEvidence}
        reason={job.eligibilityReason}
        basis={job.eligibilityBasis}
      />
      <div className="jr-actions">
        {url ? (
          <a className="jr-btn" href={url} target="_blank" rel="noopener noreferrer">
            Open posting <ArrowUpRight aria-hidden="true" />
            <span className="sr-only-jr"> (opens in a new tab)</span>
          </a>
        ) : null}
        <Link className="jr-btn" to={`/jobs/${job.id}`}>
          Details
        </Link>
        <SaveButton jobId={job.id} status={job.saved} />
      </div>
    </Card>
  );
}

// One letter-ish label so the dot is not colour-only.
function shortVerdict(verdict: string | null): string {
  if (verdict === "eligible") return "Yes";
  if (verdict === "not_eligible") return "No";
  if (verdict === "unclear") return "?";
  return "–";
}

// Compact list view (view=list): one ~60px row per job, the whole row a link.
export function JobRow({ job, now }: { job: FeedJob; now: string }) {
  const salary = formatSalary(job);
  const inr = inrPerMonth(job);
  const tone = verdictTone(job.eligibility);
  return (
    <li id={`job-${job.id}`}>
      <Link to={`/jobs/${job.id}`} className="jr-row" data-v={tone}>
        <span className="jr-row__main">
          <span className="jr-row__title">{job.title}</span>
          <span className="jr-row__meta">
            {[
              job.company,
              formatAge(jobDate(job), now),
              salary?.text,
              inr && formatInrPerMonth(inr),
            ]
              .filter(Boolean)
              .join(" · ")}
          </span>
          {job.saved ? (
            <span className="jr-row__saved">
              <BookmarkCheck aria-hidden="true" /> {STATUS_LABELS[job.saved]}
            </span>
          ) : null}
        </span>
        <span className="jr-row__v" data-v={tone}>
          <span aria-hidden="true">{shortVerdict(job.eligibility)}</span>
          <span className="sr-only-jr">{verdictStamp(job.eligibility)}</span>
        </span>
      </Link>
    </li>
  );
}
