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

  it("prefers a whole-word match over one inside a longer word", () => {
    const text = "We serve the Indian market. Based in India.";
    const r = findQuoteRange(text, "India");
    expect(r).toEqual({ start: 37, end: 42 });
    const us = "Help businesses grow across the US.";
    expect(us.slice(findQuoteRange(us, "US")?.start, findQuoteRange(us, "US")?.end)).toBe("US");
    expect(findQuoteRange(us, "US")?.start).toBe(32);
  });

  it("checks boundaries only where the quote starts or ends with a word character", () => {
    // Quote opens with "(" and ends with ")": no boundary needed on either side.
    const text = "Remote(US only)now";
    expect(findQuoteRange(text, "(US only)")).toEqual({ start: 6, end: 15 });
    // Quote ends with a word character: "Remote, US" must not match "Remote, USA".
    const two = "Remote, USA or Remote, US.";
    expect(findQuoteRange(two, "remote, us")).toEqual({ start: 15, end: 25 });
  });

  it("falls back to a match inside a word when there is no whole-word one", () => {
    const text = "For the Indian market.";
    expect(findQuoteRange(text, "India")).toEqual({ start: 8, end: 13 });
    expect(findQuoteRange(text, "India", { wholeWord: true })).toBeNull();
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
  it("finds a quote in the field it sits in", async () => {
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

  it("prefers a location the quote equals, then short fields, before the description", async () => {
    const { locateEvidence } = await import("./evidence");
    const job = {
      title: "Partner Sales Director-India/ASEAN",
      locations: ["India", "Singapore"],
      description: "Lead sales for the Indian and ASEAN market. Travel across India.",
    };
    expect(locateEvidence("India", job)).toEqual({
      field: "location",
      index: 0,
      range: { start: 0, end: 5 },
    });
    // Not equal to a location, but a whole word in the title.
    expect(locateEvidence("ASEAN", job)?.field).toBe("title");
    // The title has "India" only as part of a longer quote; the description has the sentence.
    expect(locateEvidence("Travel across India.", job)?.field).toBe("description");
  });

  it("prefers a whole word in the description over a part-word in the title", async () => {
    const { locateEvidence } = await import("./evidence");
    const job = {
      title: "Engineer, Payments for businesses",
      locations: ["Remote"],
      description: "This role is open in the US.",
    };
    expect(locateEvidence("US", job)).toEqual({
      field: "description",
      range: { start: 25, end: 27 },
    });
    // Only a part-word match anywhere: still highlighted, in the first field.
    expect(locateEvidence("pay", job)?.field).toBe("title");
  });
});
