// Real LLM for the eligibility agent: AI SDK v7 through Vercel AI Gateway, using
// a plain "provider/model" string. Auth is AI_GATEWAY_API_KEY or VERCEL_OIDC_TOKEN.
import { generateText, Output } from "ai";
import { z } from "zod";
import type { EligibilityLlm } from "./types";

export const DEFAULT_ELIGIBILITY_MODEL = "anthropic/claude-haiku-5.5";

const answerSchema = z.object({
  verdict: z.enum(["eligible", "not_eligible", "unclear"]),
  evidence: z
    .string()
    .nullable()
    .describe("Verbatim quote from one field of the posting; null when unclear."),
  reason: z.string().describe("One short sentence."),
});

// Thrown by the LLM function; `fatal` means stop calling the LLM for this run
// (auth or billing problems will not fix themselves on the next posting).
export class LlmCallError extends Error {
  constructor(
    message: string,
    readonly fatal: boolean,
  ) {
    super(message);
    this.name = "LlmCallError";
  }
}

interface ErrorLike {
  name?: string;
  message?: string;
  type?: string;
  statusCode?: number;
  cause?: unknown;
  lastError?: unknown;
  errors?: unknown[];
}

// The SDK wraps gateway errors (e.g. in a RetryError), so look through the chain.
function errorChain(err: unknown): ErrorLike[] {
  const out: ErrorLike[] = [];
  const queue: unknown[] = [err];
  while (queue.length && out.length < 10) {
    const e = queue.shift();
    if (!e || typeof e !== "object") continue;
    const el = e as ErrorLike;
    out.push(el);
    queue.push(el.lastError, el.cause);
  }
  return out;
}

export function classifyLlmError(err: unknown): LlmCallError {
  const chain = errorChain(err);
  const top = chain[0];
  const message = (top?.message ?? String(err)).replace(/\s+/g, " ").slice(0, 300);
  const fatal = chain.some(
    (e) =>
      e.type === "authentication_error" ||
      e.type === "forbidden" ||
      e.statusCode === 401 ||
      e.statusCode === 402 ||
      e.statusCode === 403 ||
      /credit|insufficient funds|billing|payment required|unauthori[sz]ed|authentication/i.test(
        e.message ?? "",
      ),
  );
  return new LlmCallError(message, fatal);
}

export interface EligibilityLlmConfig {
  llm: EligibilityLlm;
  model: string;
}

// null when no gateway credentials are set, so the agent degrades to rules-only.
export function createEligibilityLlm(
  env: Record<string, string | undefined> = process.env,
): EligibilityLlmConfig | null {
  if (!env.AI_GATEWAY_API_KEY && !env.VERCEL_OIDC_TOKEN) return null;
  const model = env.ELIGIBILITY_MODEL || DEFAULT_ELIGIBILITY_MODEL;

  const llm: EligibilityLlm = async (prompt) => {
    const started = performance.now();
    try {
      const result = await generateText({
        model,
        output: Output.object({ schema: answerSchema }),
        prompt,
        temperature: 0,
        maxOutputTokens: 400,
        maxRetries: 2,
      });
      const { output } = result;
      return {
        verdict: output.verdict,
        evidence: output.evidence,
        reason: output.reason,
        usage: {
          inputTokens: result.usage.inputTokens ?? null,
          outputTokens: result.usage.outputTokens ?? null,
          latencyMs: Math.round(performance.now() - started),
        },
      };
    } catch (err) {
      throw classifyLlmError(err);
    }
  };

  return { llm, model };
}
