// pnpm eval:eligibility             re-run checkEligibility on every hand-labelled job
//                                   (LLM when gateway credentials are set)
// pnpm eval:eligibility --fixtures  run over the tester fixtures, rules-only
// pnpm eval:eligibility --fixtures --llm   ...with the LLM for what the rules leave open
//
// Prints accuracy, a 3x3 confusion matrix (rows = label, columns = predicted),
// unclear rate and "confident wrong" (said eligible/not_eligible, label disagrees).
import { readFileSync } from "node:fs";
import path from "node:path";
import { checkEligibility } from "~/lib/eligibility";
import { postingFromJob } from "~/lib/eligibility/job";
import { createEligibilityLlm } from "~/lib/eligibility/llm";
import type { EligibilityResult, Posting, Verdict } from "~/lib/eligibility/types";
import { VERDICTS } from "~/lib/eligibility/types";

interface Item {
  id: number;
  title: string;
  company: string;
  label: Verdict | null; // null: fixture where the rules should abstain (no verdict label)
  posting: Posting;
}

const args = new Set(process.argv.slice(2));
const fixturesMode = args.has("--fixtures");
const useLlm = fixturesMode ? args.has("--llm") : true;

async function loadFixtures(): Promise<Item[]> {
  const file = path.resolve(
    import.meta.dirname,
    "../app/lib/eligibility/__fixtures__/real-postings.json",
  );
  const raw = JSON.parse(readFileSync(file, "utf8")) as {
    id: number;
    posting: Posting;
    expectedByRules: Verdict | null;
  }[];
  return raw.map((f) => ({
    id: f.id,
    title: f.posting.title,
    company: f.posting.company,
    label: f.expectedByRules,
    posting: f.posting,
  }));
}

async function loadLabels(): Promise<Item[]> {
  const { eq } = await import("drizzle-orm");
  const { db, schema } = await import("~/db");
  const rows = await db
    .select({ label: schema.eligibilityLabels.label, job: schema.jobs })
    .from(schema.eligibilityLabels)
    .innerJoin(schema.jobs, eq(schema.jobs.id, schema.eligibilityLabels.jobId))
    .all();
  return rows.map(({ label, job }) => ({
    id: job.id,
    title: job.title,
    company: job.company,
    label: label as Verdict,
    posting: postingFromJob(job),
  }));
}

const items = fixturesMode ? await loadFixtures() : await loadLabels();
if (items.length === 0) {
  console.log("No labelled jobs yet (eligibility_labels is empty). Try --fixtures.");
  process.exit(0);
}

const llmConfig = useLlm ? createEligibilityLlm() : null;
const mode = llmConfig ? `rules + llm (${llmConfig.model})` : "rules only";
if (useLlm && !llmConfig) console.log("No AI_GATEWAY_API_KEY / VERCEL_OIDC_TOKEN: rules only.");

const results: { item: Item; r: EligibilityResult | null }[] = [];
let next = 0;
await Promise.all(
  Array.from({ length: 4 }, async () => {
    while (next < items.length) {
      const item = items[next++];
      results.push({ item, r: await checkEligibility(item.posting, llmConfig ?? {}) });
    }
  }),
);
results.sort((a, b) => a.item.id - b.item.id);

const outOfScope = results.filter(({ r }) => r === null);
const scored = results.filter(
  (x): x is { item: Item & { label: Verdict }; r: EligibilityResult } =>
    x.r !== null && x.item.label !== null,
);
const abstainers = results.filter(
  (x): x is { item: Item; r: EligibilityResult } => x.r !== null && x.item.label === null,
);

const matrix = Object.fromEntries(
  VERDICTS.map((l) => [l, Object.fromEntries(VERDICTS.map((p) => [p, 0]))]),
) as Record<Verdict, Record<Verdict, number>>;
for (const { item, r } of scored) matrix[item.label][r.verdict]++;

const correct = scored.filter(({ item, r }) => item.label === r.verdict).length;
const unclear = scored.filter(({ r }) => r.verdict === "unclear").length;
const confidentWrong = scored.filter(
  ({ item, r }) => r.verdict !== "unclear" && r.verdict !== item.label,
);
const pct = (n: number, d: number) => (d ? `${((100 * n) / d).toFixed(1)}%` : "n/a");

console.log(`\nEligibility eval: ${fixturesMode ? "tester fixtures" : "hand labels"}, ${mode}`);
console.log(`items ${items.length}, scored ${scored.length}, out of scope ${outOfScope.length}`);
console.log(`accuracy        ${correct}/${scored.length} = ${pct(correct, scored.length)}`);
console.log(`unclear rate    ${unclear}/${scored.length} = ${pct(unclear, scored.length)}`);
console.log(`confident wrong ${confidentWrong.length}`);

const w = 14;
console.log(`\n${"label \\ pred".padEnd(w)}${VERDICTS.map((v) => v.padStart(w)).join("")}`);
for (const l of VERDICTS) {
  console.log(`${l.padEnd(w)}${VERDICTS.map((p) => String(matrix[l][p]).padStart(w)).join("")}`);
}

for (const { item, r } of confidentWrong) {
  console.log(
    `  WRONG #${item.id} ${item.title} · ${item.company}: label ${item.label}, said ${r.verdict} (${r.method}) "${r.evidence}"`,
  );
}

if (abstainers.length) {
  // Fixtures with expectedByRules null have no verdict label: the rules must abstain.
  const abstained = abstainers.filter(({ r }) => r.method !== "rules").length;
  const rulesUnclear = abstainers.filter(
    ({ r }) => r.method === "rules" && r.verdict === "unclear",
  ).length;
  console.log(
    `\nrules-should-abstain fixtures: ${abstainers.length} (rules abstained on ${abstained + rulesUnclear})`,
  );
  if (llmConfig) {
    for (const { item, r } of abstainers) {
      console.log(
        `  #${item.id} ${item.title.slice(0, 50)} · ${item.company}: ${r.verdict} (${r.method}) ${r.evidence ? `"${r.evidence}"` : `- ${r.reason}`}`,
      );
    }
  }
}
