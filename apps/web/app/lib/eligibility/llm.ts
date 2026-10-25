// Real LLM for the eligibility agent, AI SDK v7. Google Gemini directly when
// GOOGLE_GENERATIVE_AI_API_KEY is set; otherwise Vercel AI Gateway with a plain
// "provider/model" string (auth: AI_GATEWAY_API_KEY or VERCEL_OIDC_TOKEN).
import { createGoogle, type GoogleLanguageModelOptions } from "@ai-sdk/google";
import { generateText, type LanguageModel, Output } from "ai";
import { z } from "zod";
import type { EligibilityLlm } from "./types";

export const DEFAULT_ELIGIBILITY_MODEL = "anthropic/claude-haiku-5.5";
export const DEFAULT_GOOGLE_ELIGIBILITY_MODEL = "gemini-3.5-flash-lite";

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
// `rateLimited` (HTTP 429) is not fatal for one posting; the task stops the run
// after several in a row.
export class LlmCallError extends Error {
  constructor(
    message: string,
    readonly fatal: boolean,
    readonly rateLimited = false,
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
  // Checked first: Google's free-tier 429 text mentions "plan and billing details",
  // which would otherwise read as a billing failure.
  if (chain.some((e) => e.statusCode === 429 || e.type === "rate_limit_exceeded")) {
    return new LlmCallError(message, false, true);
  }
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

interface ModelChoice {
  // What generateText gets: a provider model, or a gateway "provider/model" string.
  model: LanguageModel;
  // Stored with every result, always "provider/model".
  id: string;
  providerOptions?: { google: GoogleLanguageModelOptions };
}

// Google directly when its key is set and ELIGIBILITY_MODEL is unset, bare
// ("gemini-...") or "google/..."; else the gateway when it has credentials.
function chooseModel(env: Record<string, string | undefined>): ModelChoice | null {
  const requested = env.ELIGIBILITY_MODEL?.trim() || "";
  const googleModel = requested.startsWith("google/")
    ? requested.slice("google/".length)
    : requested.includes("/")
      ? null
      : requested || DEFAULT_GOOGLE_ELIGIBILITY_MODEL;

  if (env.GOOGLE_GENERATIVE_AI_API_KEY && googleModel) {
    const google = createGoogle({ apiKey: env.GOOGLE_GENERATIVE_AI_API_KEY });
    return {
      model: google(googleModel),
      id: `google/${googleModel}`,
      // Gemini 3+ thinks by default; this is a short extraction task.
      ...(/^gemini-[3-9]/.test(googleModel)
        ? { providerOptions: { google: { thinkingConfig: { thinkingLevel: "minimal" } } } }
        : {}),
    };
  }
  if (env.AI_GATEWAY_API_KEY || env.VERCEL_OIDC_TOKEN) {
    const id = requested || DEFAULT_ELIGIBILITY_MODEL;
    return { model: id, id };
  }
  return null;
}

// null when no LLM credentials are set, so the agent degrades to rules-only.
export function createEligibilityLlm(
  env: Record<string, string | undefined> = process.env,
): EligibilityLlmConfig | null {
  const choice = chooseModel(env);
  if (!choice) return null;

  const llm: EligibilityLlm = async (prompt) => {
    const started = performance.now();
    try {
      const result = await generateText({
        model: choice.model,
        ...(choice.providerOptions ? { providerOptions: choice.providerOptions } : {}),
        output: Output.object({ schema: answerSchema }),
        prompt,
        temperature: 0,
        maxOutputTokens: 400,
        maxRetries: 2,
        // Overloaded providers can hold a request for minutes; give up on this
        // posting (it is retried next run) instead of stalling the task.
        timeout: 120_000,
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

  return { llm, model: choice.id };
}
