// Eligibility agent v0: can someone living in India get this job and do it
// remotely from India? Spec: eligibility-spec.md.

// Bump whenever the rules or the LLM prompt change; stored with every result so
// the check task re-runs postings judged by an older version.
export const PROMPT_VERSION = "elig-v0.2";

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
  method: "rules" | "llm";
  model?: string;
  promptVersion: string;
  // Present when the LLM was called.
  usage?: LlmUsage;
  // Present when the LLM call failed; the verdict is then "unclear".
  error?: { message: string; fatal: boolean };
}

export interface LlmAnswer {
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
