// Eligibility agent: can someone living in India get this job and do it
// remotely from India? Spec: eligibility-spec.md, hints: eligibility-v04-spec.md.

// Bump whenever the rules or the LLM prompt change; stored with every result so
// the check task re-runs postings judged by an older version.
export const PROMPT_VERSION = "elig-v0.4.1";

export type Verdict = "eligible" | "not_eligible" | "unclear";

export const VERDICTS: readonly Verdict[] = ["eligible", "not_eligible", "unclear"];

export interface Posting {
  title: string;
  company: string;
  locations: string[];
  // Only "remote" and null are in scope; anything else ("hybrid", "onsite") is skipped.
  workMode: string | null;
  description: string;
}

// One phrase from the posting that makes India more or less likely.
export interface Hint {
  // Verbatim from one field of the posting (checked in code).
  quote: string;
  // Short name of the part it came from: "locations", "perks", "pay", ...
  section: string;
  points: "india_ok" | "india_blocked";
  // strong: says who can be hired or from where. weak: only suggests it.
  strength: "strong" | "weak";
}

// "explicit": a strong hint decided it (rules results always). "hints": only
// weak hints did. null when unclear.
export type Basis = "explicit" | "hints";

export interface LlmUsage {
  inputTokens: number | null;
  outputTokens: number | null;
  latencyMs: number;
}

export interface EligibilityResult {
  verdict: Verdict;
  // Verbatim text from the posting the verdict rests on. null only when "unclear".
  evidence: string | null;
  reason: string;
  basis: Basis | null;
  // Verified hints only, in the model's order (strongest first).
  hints: Hint[];
  method: "rules" | "llm";
  model?: string;
  promptVersion: string;
  // Present when the LLM was called.
  usage?: LlmUsage;
  // Present when the LLM call failed; the verdict is then "unclear".
  // rateLimited: the provider answered 429 (try this posting again later).
  error?: { message: string; fatal: boolean; rateLimited?: boolean };
}

export interface LlmAnswer {
  hints: Hint[];
  verdict: Verdict;
  evidence: string | null;
  reason: string;
  usage?: LlmUsage;
}

export type EligibilityLlm = (prompt: string) => Promise<LlmAnswer>;

export interface CheckOptions {
  llm?: EligibilityLlm | null;
  model?: string;
}
