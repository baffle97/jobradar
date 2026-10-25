// No network: generateText is mocked, so these only check provider selection,
// the request shape and error classification.
import { beforeEach, describe, expect, it, vi } from "vitest";

const generateText = vi.fn();
vi.mock("ai", async (importOriginal) => ({
  ...(await importOriginal<typeof import("ai")>()),
  generateText: (...args: unknown[]) => generateText(...args),
}));

const { classifyLlmError, createEligibilityLlm, LlmCallError } = await import("./llm");
const { checkEligibility } = await import("./index");
const { posting } = await import("./test-helpers");

const GOOGLE = { GOOGLE_GENERATIVE_AI_API_KEY: "test-google-key" };
const GATEWAY = { AI_GATEWAY_API_KEY: "test-gateway-key" };

describe("createEligibilityLlm: provider choice", () => {
  it.each([
    [{}, null],
    [GATEWAY, "anthropic/claude-haiku-5.5"],
    [{ VERCEL_OIDC_TOKEN: "oidc" }, "anthropic/claude-haiku-5.5"],
    [GOOGLE, "google/gemini-3.5-flash-lite"],
    [{ ...GOOGLE, ...GATEWAY }, "google/gemini-3.5-flash-lite"],
    [{ ...GOOGLE, ELIGIBILITY_MODEL: "gemini-2.5-flash-lite" }, "google/gemini-2.5-flash-lite"],
    [{ ...GOOGLE, ELIGIBILITY_MODEL: "google/gemini-2.5-flash" }, "google/gemini-2.5-flash"],
    // Another provider's model goes through the gateway when it can.
    [{ ...GOOGLE, ...GATEWAY, ELIGIBILITY_MODEL: "openai/gpt-x" }, "openai/gpt-x"],
    [{ ...GOOGLE, ELIGIBILITY_MODEL: "openai/gpt-x" }, null],
  ])("%j -> %s", (env, model) => {
    expect(createEligibilityLlm(env)?.model ?? null).toBe(model);
  });
});

describe("createEligibilityLlm: calls", () => {
  // Braces matter: a function returned from beforeEach runs as teardown.
  beforeEach(() => {
    generateText.mockReset();
  });

  it("google path passes a provider model and minimal thinking for Gemini 3", async () => {
    generateText.mockResolvedValue({
      output: { verdict: "unclear", evidence: null, reason: "r" },
      usage: { inputTokens: 10, outputTokens: 5 },
    });
    const cfg = createEligibilityLlm(GOOGLE);
    const answer = await cfg?.llm("prompt");
    const call = generateText.mock.calls[0][0];
    expect(call.model).toMatchObject({ modelId: "gemini-3.5-flash-lite" });
    expect(call.providerOptions).toEqual({
      google: { thinkingConfig: { thinkingLevel: "minimal" } },
    });
    expect(answer?.usage).toMatchObject({ inputTokens: 10, outputTokens: 5 });
  });

  it("gateway path passes the plain model string", async () => {
    generateText.mockResolvedValue({
      output: { verdict: "unclear", evidence: null, reason: "r" },
      usage: {},
    });
    await createEligibilityLlm(GATEWAY)?.llm("prompt");
    const call = generateText.mock.calls[0][0];
    expect(call.model).toBe("anthropic/claude-haiku-5.5");
    expect(call.providerOptions).toBeUndefined();
  });

  it("a 429 surfaces as a rate-limited, non-fatal unclear result", async () => {
    // Shaped like the SDK's RetryError wrapping a Google 429 APICallError.
    const retryError = Object.assign(new Error("Failed after 3 attempts"), {
      lastError: {
        statusCode: 429,
        message: "You exceeded your current quota, please check your plan and billing details.",
      },
    });
    generateText.mockImplementation(async () => {
      throw retryError;
    });
    const cfg = createEligibilityLlm(GOOGLE);
    if (!cfg) throw new Error("no llm");
    const r = await checkEligibility(posting(), cfg);
    expect(r?.verdict).toBe("unclear");
    expect(r?.error).toMatchObject({ fatal: false, rateLimited: true });
  });
});

describe("classifyLlmError", () => {
  it.each([
    [{ statusCode: 429, message: "check your plan and billing details" }, false, true],
    [{ statusCode: 401, message: "bad key" }, true, false],
    [{ statusCode: 402, message: "payment required" }, true, false],
    [{ message: "insufficient funds on your account" }, true, false],
    [{ statusCode: 500, message: "internal" }, false, false],
  ])("%j -> fatal %s, rateLimited %s", (err, fatal, rateLimited) => {
    const e = classifyLlmError(err);
    expect(e).toBeInstanceOf(LlmCallError);
    expect(e.fatal).toBe(fatal);
    expect(e.rateLimited).toBe(rateLimited);
  });
});
