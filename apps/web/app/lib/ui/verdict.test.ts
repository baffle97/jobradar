import { describe, expect, it } from "vitest";
import { reasonForDisplay } from "./verdict";

describe("reasonForDisplay", () => {
  it("replaces reasons about the system with a plain line", () => {
    const plain = "Not decided yet: the posting doesn't say where you can work from.";
    expect(reasonForDisplay("No explicit location rule matched and no LLM is configured.")).toBe(
      plain,
    );
    const failed = reasonForDisplay(
      "LLM call failed: Failed after 3 attempts. Last error: AI_APICallError",
    );
    expect(failed).toMatch(/^Not decided yet:/);
    expect(failed).not.toMatch(/LLM|AI_API/);
    const lost = reasonForDisplay(
      "The model said eligible but its quote could not be found in the posting.",
    );
    expect(lost).toMatch(/^Not decided yet:/);
    expect(lost).not.toMatch(/model/i);
  });

  it("keeps reasons about the posting and passes null through", () => {
    const r = "The posting requires residence in the United States.";
    expect(reasonForDisplay(r)).toBe(r);
    expect(reasonForDisplay(null)).toBeNull();
  });
});
