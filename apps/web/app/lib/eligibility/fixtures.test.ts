// Sanity checks on the real-posting fixtures themselves. These do not touch the
// eligibility implementation, so they pass before the module exists.
import { describe, expect, it } from "vitest";
import { collapse, realFixtures } from "./test-helpers";

describe("real-postings.json fixtures", () => {
  it("has a reasonable spread of labels", () => {
    const count = (v: unknown) => realFixtures.filter((f) => f.expectedByRules === v).length;
    expect(realFixtures.length).toBeGreaterThanOrEqual(40);
    expect(count("eligible")).toBeGreaterThanOrEqual(8);
    expect(count("not_eligible")).toBeGreaterThanOrEqual(8);
    expect(count(null)).toBeGreaterThanOrEqual(8);
  });

  it("ids are unique", () => {
    const ids = realFixtures.map((f) => f.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it.each(realFixtures.map((f) => [f.id, f] as const))("#%i is well formed", (_id, f) => {
    expect(f.labelledBy).toBe("tester-agent-draft");
    expect(["remote", null]).toContain(f.posting.workMode);
    expect(Array.isArray(f.posting.locations)).toBe(true);
    expect(f.posting.description.length).toBeLessThanOrEqual(3200);
    expect(f.why.length).toBeGreaterThan(0);

    // A quote exactly when the rules are expected to decide.
    if (f.expectedByRules === null) {
      expect(f.expectedQuote).toBeNull();
    } else {
      expect(f.expectedQuote).toBeTruthy();
      // The expected quote must sit inside ONE field of the posting.
      const fields = [f.posting.title, ...f.posting.locations, f.posting.description].map(collapse);
      const q = collapse(f.expectedQuote ?? "");
      expect(fields.some((field) => field.includes(q))).toBe(true);
    }
  });
});
