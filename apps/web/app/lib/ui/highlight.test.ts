import { describe, expect, it } from "vitest";
import { quoteIsInPosting } from "~/lib/eligibility/verify";
import { findQuoteRange, splitAtRange } from "./highlight";

describe("findQuoteRange", () => {
  it("finds an exact quote", () => {
    const text = "We are remote. Must reside in the US. Benefits.";
    const r = findQuoteRange(text, "Must reside in the US.");
    expect(r).not.toBeNull();
    expect(text.slice(r?.start, r?.end)).toBe("Must reside in the US.");
  });

  it("ignores case and whitespace runs, returning offsets into the original", () => {
    const text = "About\n\nLocation:\n  Remote  within\tthe EU   only.\nThanks";
    const quote = "remote within the eu only.";
    const r = findQuoteRange(text, quote);
    expect(text.slice(r?.start, r?.end)).toBe("Remote  within\tthe EU   only.");
  });

  it("handles non-breaking spaces like quoteIsInPosting does", () => {
    const text = "Open to candidates in India and APAC.";
    const quote = "candidates in india and apac";
    expect(
      quoteIsInPosting(quote, {
        title: "",
        company: "",
        locations: [],
        workMode: null,
        description: text,
      }),
    ).toBe(true);
    const r = findQuoteRange(text, quote);
    expect(text.slice(r?.start, r?.end)).toBe("candidates in India and APAC");
  });

  it("returns null when the quote is missing or empty", () => {
    expect(findQuoteRange("Remote, US only", "Remote, anywhere")).toBeNull();
    expect(findQuoteRange("Remote", "   ")).toBeNull();
    expect(findQuoteRange("", "Remote")).toBeNull();
  });

  it("splits text into before / quote / after", () => {
    const text = "a Remote (US) b";
    expect(splitAtRange(text, findQuoteRange(text, "remote (us)"))).toEqual([
      "a ",
      "Remote (US)",
      " b",
    ]);
    expect(splitAtRange(text, null)).toBeNull();
  });
});

describe("locateEvidence", () => {
  const posting = {
    title: "Senior Engineer (Remote, India)",
    locations: ["Berlin, Germany", "Remote - India"],
    description: "We hire across APAC.\nMust overlap 4h with CET.",
  };
  it("prefers the description, then the title, then a location", async () => {
    const { locateEvidence } = await import("./evidence");
    expect(locateEvidence("we hire across apac.", posting)?.field).toBe("description");
    expect(locateEvidence("Remote, India", posting)?.field).toBe("title");
    expect(locateEvidence("remote - india", posting)).toEqual({
      field: "location",
      index: 1,
      range: { start: 0, end: 14 },
    });
    expect(locateEvidence("Tokyo", posting)).toBeNull();
    expect(locateEvidence(null, posting)).toBeNull();
  });
});
