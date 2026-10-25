// Scheduler task "eligibility:check": judge active in-scope jobs that have no
// current result, write the audit row and the latest-result columns on jobs.
import { and, desc, eq, isNull, or } from "drizzle-orm";
import { db, schema } from "~/db";
import { applyRules, checkEligibility, inScope } from "./index";
import { postingFromJob, postingHash } from "./job";
import { createEligibilityLlm } from "./llm";
import type { EligibilityResult } from "./types";
import { PROMPT_VERSION } from "./types";

const CONCURRENCY = 4;

function intOr(value: unknown, fallback: number): number {
  const n = Number(value);
  return Number.isFinite(n) && n >= 0 ? Math.floor(n) : fallback;
}

async function runPool<T>(items: T[], size: number, fn: (item: T) => Promise<void>) {
  let next = 0;
  await Promise.all(
    Array.from({ length: Math.min(size, items.length) }, async () => {
      while (next < items.length) {
        const item = items[next++];
        await fn(item);
      }
    }),
  );
}

async function saveResult(jobId: number, r: EligibilityResult, inputHash: string) {
  const now = new Date().toISOString();
  await db.batch([
    db.insert(schema.eligibilityChecks).values({
      jobId,
      verdict: r.verdict,
      evidence: r.evidence,
      reason: r.reason,
      method: r.method,
      model: r.model ?? null,
      promptVersion: r.promptVersion,
      inputHash,
      inputTokens: r.usage?.inputTokens ?? null,
      outputTokens: r.usage?.outputTokens ?? null,
      latencyMs: r.usage?.latencyMs ?? null,
      createdAt: now,
    }),
    db
      .update(schema.jobs)
      .set({
        eligibility: r.verdict,
        eligibilityEvidence: r.evidence,
        eligibilityReason: r.reason,
        eligibilityMethod: r.method,
        // A failed LLM call is recorded but not stamped, so the next run retries it.
        eligibilityVersion: r.error ? null : r.promptVersion,
        eligibilityInputHash: inputHash,
        eligibilityCheckedAt: now,
      })
      .where(eq(schema.jobs.id, jobId)),
  ]);
}

export async function runEligibilityCheck(payload?: unknown) {
  const opts = (payload ?? {}) as { maxJobs?: unknown; maxLlmCalls?: unknown };
  const maxJobs = intOr(opts.maxJobs, 300);
  const maxLlmCalls = intOr(opts.maxLlmCalls, 150);
  const llmConfig = createEligibilityLlm();

  const rows = await db
    .select({
      id: schema.jobs.id,
      title: schema.jobs.title,
      company: schema.jobs.company,
      location: schema.jobs.location,
      locations: schema.jobs.locations,
      workMode: schema.jobs.workMode,
      description: schema.jobs.description,
      eligibility: schema.jobs.eligibility,
      eligibilityMethod: schema.jobs.eligibilityMethod,
      eligibilityVersion: schema.jobs.eligibilityVersion,
      eligibilityInputHash: schema.jobs.eligibilityInputHash,
    })
    .from(schema.jobs)
    .where(
      and(
        eq(schema.jobs.isActive, true),
        or(isNull(schema.jobs.workMode), eq(schema.jobs.workMode, "remote")),
      ),
    )
    .orderBy(desc(schema.jobs.id))
    .all();

  // Idempotent: a job is re-checked only when its result is from another
  // version, its text changed, or it was left "unclear" for lack of an LLM.
  const candidates = rows
    .map((row) => {
      const posting = postingFromJob(row);
      return { row, posting, hash: postingHash(posting) };
    })
    .filter(
      ({ row, posting, hash }) =>
        inScope(posting) &&
        (row.eligibilityVersion !== PROMPT_VERSION ||
          row.eligibilityInputHash !== hash ||
          (llmConfig !== null &&
            row.eligibility === "unclear" &&
            row.eligibilityMethod === "rules")),
    );
  const batch = candidates.slice(0, maxJobs);

  const stats = {
    inScope: rows.length,
    upToDate: rows.length - candidates.length,
    pending: candidates.length,
    checked: 0,
    byVerdict: { eligible: 0, not_eligible: 0, unclear: 0 } as Record<string, number>,
    byMethod: { rules: 0, llm: 0 } as Record<string, number>,
    llm: llmConfig ? llmConfig.model : null,
    llmCalls: 0,
    llmErrors: 0,
    llmStopped: null as string | null,
    deferred: 0, // needed the LLM but the budget ran out or the LLM was stopped
    inputTokens: 0,
    outputTokens: 0,
    failed: 0,
    firstFailure: null as string | null,
  };

  await runPool(batch, CONCURRENCY, async ({ row, posting, hash }) => {
    try {
      let result: EligibilityResult | null;
      if (llmConfig && applyRules(posting) === null) {
        if (stats.llmStopped || stats.llmCalls >= maxLlmCalls) {
          stats.deferred++;
          return;
        }
        stats.llmCalls++;
        result = await checkEligibility(posting, llmConfig);
      } else {
        result = await checkEligibility(posting);
      }
      if (!result) return;

      if (result.error) {
        stats.llmErrors++;
        if (result.error.fatal && !stats.llmStopped) stats.llmStopped = result.error.message;
      }
      stats.inputTokens += result.usage?.inputTokens ?? 0;
      stats.outputTokens += result.usage?.outputTokens ?? 0;

      await saveResult(row.id, result, hash);
      stats.checked++;
      stats.byVerdict[result.verdict]++;
      stats.byMethod[result.method]++;
    } catch (err) {
      stats.failed++;
      stats.firstFailure ??= err instanceof Error ? err.message : String(err);
    }
  });

  console.log(
    `[eligibility] checked ${stats.checked}/${batch.length} (pending ${stats.pending}), ` +
      `llm calls ${stats.llmCalls}, deferred ${stats.deferred}` +
      (stats.llmStopped ? `, llm stopped: ${stats.llmStopped}` : ""),
  );
  return stats;
}
