import { createHash } from "node:crypto";
import { and, eq, inArray, lt, sql } from "drizzle-orm";
import { db, schema } from "~/db";
import { roleTags } from "~/lib/ui/roles";
import { fetchAshbyBoard } from "./ashby";
import { fetchGreenhouseBoard } from "./greenhouse";
import { fetchLeverBoard } from "./lever";
import { candidateTokens, ycBoardIsTrusted } from "./refs";
import { ATS_LIST, type Ats, type BoardFetchResult, type BoardJob, type BoardRef } from "./types";

const MAX_FAILURES = 5;
// Keeps each Turso batch request a reasonable size on boards with hundreds of jobs.
const UPSERT_BATCH = 100;

type Board = typeof schema.companyBoards.$inferSelect;

export function fetchBoard(ats: Ats, token: string, companyName?: string) {
  if (ats === "ashby") return fetchAshbyBoard(token, companyName);
  if (ats === "greenhouse") return fetchGreenhouseBoard(token);
  return fetchLeverBoard(token, companyName);
}

export function boardJobHash(ats: Ats, token: string, externalId: string): string {
  return createHash("md5").update(`${ats}|${token.toLowerCase()}|${externalId}`).digest("hex");
}

async function mapLimit<T, R>(items: T[], limit: number, fn: (item: T) => Promise<R>) {
  const results: R[] = new Array(items.length);
  let next = 0;
  const workers = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (next < items.length) {
      const i = next++;
      results[i] = await fn(items[i]);
    }
  });
  await Promise.all(workers);
  return results;
}

export async function registerBoards(
  refs: (BoardRef & { companyName?: string })[],
  discoveredFrom: string,
): Promise<number> {
  let added = 0;
  for (const ref of refs) {
    const result = await db
      .insert(schema.companyBoards)
      .values({
        ats: ref.ats,
        token: ref.token,
        companyName: ref.companyName,
        discoveredFrom,
      })
      .onConflictDoNothing()
      .run();
    added += result.rowsAffected;
  }
  return added;
}

async function upsertBoardJobs(board: Board, jobs: BoardJob[], seenAt: string) {
  const existing = new Set(
    (
      await db
        .select({ hash: schema.jobs.dedupHash })
        .from(schema.jobs)
        .where(eq(schema.jobs.boardId, board.id))
        .all()
    ).map((r) => r.hash),
  );

  let inserted = 0;
  const upserts = jobs.map((job) => {
    const dedupHash = boardJobHash(board.ats as Ats, board.token, job.externalId);
    if (!existing.has(dedupHash)) inserted++;

    const fields = {
      title: job.title,
      // Re-tagged on every poll, so a renamed posting gets new tags.
      roles: roleTags(job.title),
      company: job.company,
      location: job.locations.join("; ") || null,
      locations: job.locations,
      country: job.country ?? null,
      workMode: job.workMode ?? null,
      jobType: job.jobType ?? null,
      description: job.description,
      sourceUrl: job.sourceUrl,
      applyUrl: job.applyUrl ?? null,
      postedAt: job.postedAt ?? null,
      salaryMin: job.salaryMin ?? null,
      salaryMax: job.salaryMax ?? null,
      salaryCurrency: job.salaryCurrency ?? null,
      salaryText: job.salaryText ?? null,
      isActive: true,
      lastSeenAt: seenAt,
    };

    return db
      .insert(schema.jobs)
      .values({
        ...fields,
        source: board.ats,
        boardId: board.id,
        externalId: job.externalId,
        dedupHash,
      })
      .onConflictDoUpdate({ target: schema.jobs.dedupHash, set: fields });
  });

  // A batch runs as one transaction in a single round trip, which matters
  // against Turso where an interactive transaction pays latency per statement.
  for (let i = 0; i < upserts.length; i += UPSERT_BATCH) {
    const [first, ...rest] = upserts.slice(i, i + UPSERT_BATCH);
    await db.batch([first, ...rest]);
  }

  // Anything this board no longer lists has been closed or filled.
  const closed = await db
    .update(schema.jobs)
    .set({ isActive: false })
    .where(
      and(
        eq(schema.jobs.boardId, board.id),
        eq(schema.jobs.isActive, true),
        lt(schema.jobs.lastSeenAt, seenAt),
      ),
    )
    .run();

  return { inserted, updated: jobs.length - inserted, closed: closed.rowsAffected };
}

async function pollBoard(board: Board) {
  const polledAt = new Date().toISOString();
  let result: BoardFetchResult;

  try {
    result = await fetchBoard(board.ats as Ats, board.token, board.companyName ?? undefined);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    await db
      .update(schema.companyBoards)
      .set({
        status: "error",
        lastError: message,
        lastPolledAt: polledAt,
        consecutiveFailures: board.consecutiveFailures + 1,
      })
      .where(eq(schema.companyBoards.id, board.id))
      .run();
    return { outcome: "error" as const };
  }

  if (result.status === "not_found") {
    await db
      .update(schema.companyBoards)
      .set({ status: "not_found", lastPolledAt: polledAt, lastError: null })
      .where(eq(schema.companyBoards.id, board.id))
      .run();
    return { outcome: "not_found" as const };
  }

  const counts = await upsertBoardJobs(board, result.jobs, polledAt);
  await db
    .update(schema.companyBoards)
    .set({
      status: "ok",
      consecutiveFailures: 0,
      lastError: null,
      lastPolledAt: polledAt,
      jobCount: result.jobs.length,
      companyName: board.companyName ?? result.companyName,
    })
    .where(eq(schema.companyBoards.id, board.id))
    .run();
  return { outcome: "ok" as const, ...counts };
}

export async function ingestBoards(payload?: unknown) {
  const maxBoards = (payload as { maxBoards?: number } | undefined)?.maxBoards ?? 200;

  const boards = await db
    .select()
    .from(schema.companyBoards)
    .where(
      and(
        inArray(schema.companyBoards.status, ["pending", "ok", "error"]),
        lt(schema.companyBoards.consecutiveFailures, MAX_FAILURES),
      ),
    )
    // Never-polled boards first, then the stalest.
    .orderBy(
      sql`${schema.companyBoards.lastPolledAt} IS NOT NULL`,
      schema.companyBoards.lastPolledAt,
    )
    .limit(maxBoards)
    .all();

  const results = await mapLimit(boards, 4, pollBoard);

  const summary = {
    boards: boards.length,
    ok: 0,
    notFound: 0,
    errors: 0,
    inserted: 0,
    updated: 0,
    closed: 0,
  };
  for (const r of results) {
    if (r.outcome === "ok") {
      summary.ok++;
      summary.inserted += r.inserted;
      summary.updated += r.updated;
      summary.closed += r.closed;
    } else if (r.outcome === "not_found") {
      summary.notFound++;
    } else {
      summary.errors++;
    }
  }

  console.log(
    `[ats] polled ${summary.boards} boards: ${summary.ok} ok, ${summary.notFound} not found, ${summary.errors} errors; ${summary.inserted} new, ${summary.closed} closed`,
  );
  return summary;
}

interface YCCompany {
  name: string;
  slug: string;
  website?: string | null;
  isHiring?: boolean;
}

const YC_COMPANIES_URL = "https://yc-oss.github.io/api/companies/all.json";

// Guesses board tokens for hiring YC companies and keeps the ones that exist.
// Every guess is recorded (found or not) so it is never probed twice.
export async function discoverFromYC(payload?: unknown) {
  const batchSize = (payload as { batchSize?: number } | undefined)?.batchSize ?? 60;

  const res = await fetch(YC_COMPANIES_URL, { signal: AbortSignal.timeout(60_000) });
  if (!res.ok) throw new Error(`YC companies API failed: ${res.status}`);
  const companies: YCCompany[] = await res.json();

  const known = new Set(
    (
      await db
        .select({ ats: schema.companyBoards.ats, token: schema.companyBoards.token })
        .from(schema.companyBoards)
        .all()
    ).map((b) => `${b.ats}:${b.token.toLowerCase()}`),
  );

  const probes: { ats: Ats; token: string; companyName: string; website?: string | null }[] = [];
  let companiesQueued = 0;
  for (const company of companies) {
    if (!company.isHiring) continue;
    const pending = candidateTokens(company.slug, company.website).flatMap((token) =>
      ATS_LIST.filter((ats) => !known.has(`${ats}:${token}`)).map((ats) => ({
        ats,
        token,
        companyName: company.name,
        website: company.website,
      })),
    );
    if (pending.length === 0) continue;
    probes.push(...pending);
    if (++companiesQueued >= batchSize) break;
  }

  let found = 0;
  await mapLimit(probes, 4, async (probe) => {
    let status: "pending" | "not_found" | "error" = "not_found";
    let companyName = probe.companyName;
    let lastError: string | null = null;
    try {
      const result = await fetchBoard(probe.ats, probe.token, probe.companyName);
      if (result.status === "ok") {
        const trusted = ycBoardIsTrusted({
          token: probe.token,
          website: probe.website,
          companyName: probe.companyName,
          boardCompanyName: result.companyName,
          jobs: result.jobs,
        });
        if (trusted && result.jobs.length > 0) {
          status = "pending";
          companyName = result.companyName ?? probe.companyName;
          found++;
        }
      }
    } catch (err) {
      status = "error";
      lastError = err instanceof Error ? err.message : String(err);
    }

    await db
      .insert(schema.companyBoards)
      .values({
        ats: probe.ats,
        token: probe.token,
        companyName,
        discoveredFrom: "yc",
        status,
        lastError,
        consecutiveFailures: status === "error" ? 1 : 0,
      })
      .onConflictDoNothing()
      .run();
  });

  console.log(
    `[ats] YC discovery: ${companiesQueued} companies, ${probes.length} probes, ${found} boards found`,
  );
  return { companies: companiesQueued, probes: probes.length, found };
}
