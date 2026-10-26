// elig-v0.4 UI helpers: the "from hints" tag, the two hint groups on the job
// page, and marking every hint quote in the posting text.
import { describe, expect, it } from "vitest";
import type { Hint } from "~/lib/eligibility/types";
import { locateMarks } from "./evidence";
import { markSegments } from "./highlight";
import { basisTag, groupHints, reasonForDisplay, sectionLabel } from "./verdict";

function hint(quote: string, overrides: Partial<Hint> = {}): Hint {
  return { quote, section: "perks", points: "india_ok", strength: "weak", ...overrides };
}

describe("basisTag", () => {
  it('shows "from hints" only for a decided verdict with basis hints', () => {
    expect(basisTag("eligible", "hints")).toBe("from hints");
    expect(basisTag("not_eligible", "hints")).toBe("from hints");
    expect(basisTag("eligible", "explicit")).toBeNull();
    expect(basisTag("eligible", null)).toBeNull();
    expect(basisTag("unclear", "hints")).toBeNull();
    expect(basisTag(null, "hints")).toBeNull();
  });
});

describe("groupHints", () => {
  it("splits by direction and puts strong hints first, keeping order otherwise", () => {
    const hints = [
      hint("a weak yes"),
      hint("a weak no", { points: "india_blocked" }),
      hint("a strong yes", { strength: "strong" }),
      hint("another weak yes"),
      hint("a strong no", { points: "india_blocked", strength: "strong" }),
    ];
    const { yes, no } = groupHints(hints);
    expect(yes.map((h) => h.quote)).toEqual(["a strong yes", "a weak yes", "another weak yes"]);
    expect(no.map((h) => h.quote)).toEqual(["a strong no", "a weak no"]);
  });

  it("treats null (rows from before v0.4) and junk as no hints", () => {
    expect(groupHints(null)).toEqual({ yes: [], no: [] });
    expect(groupHints("nope" as unknown as Hint[])).toEqual({ yes: [], no: [] });
    expect(groupHints([{ quote: 3 } as unknown as Hint, hint("ok")]).yes).toHaveLength(1);
  });
});

describe("reasonForDisplay (v0.4)", () => {
  it("hides the lost-hints pipeline reason", () => {
    expect(reasonForDisplay("The model's hints could not be found in the posting.")).toMatch(
      /^Not decided yet:/,
    );
  });
});

describe("locateMarks", () => {
  const posting = {
    title: "Backend Engineer (US)",
    locations: ["Remote", "Remote - US"],
    description:
      "We believe in global meetups of our team. Our businesses grow.\n" +
      "Benefits: 401(k) matching and US medical.",
  };

  it("marks the main evidence and every hint, each in its own field", () => {
    const marks = locateMarks(
      "Remote - US",
      [hint("Remote - US"), hint("global meetups")],
      posting,
    );
    expect(marks.locations[1]).toEqual([{ start: 0, end: 11, kind: "main" }]);
    expect(marks.locations[0]).toEqual([]);
    const [m] = marks.description;
    expect(posting.description.slice(m.start, m.end)).toBe("global meetups");
    expect(m.kind).toBe("hint");
  });

  it("matches hint quotes on whole words only", () => {
    // "US" must not mark the "us" inside "businesses"; it marks the title "(US)".
    const marks = locateMarks(null, [hint("US", { points: "india_blocked" })], posting);
    expect(marks.description).toEqual([]);
    expect(posting.title.slice(marks.title[0].start, marks.title[0].end)).toBe("US");
  });

  it("a joined quote marks each part, as main or hint", () => {
    const p = { title: "Engineer", locations: ["North America", "APJ", "EMEA"], description: "" };
    const marks = locateMarks("APJ | EMEA", [hint("North America | APJ")], p);
    expect(marks.locations).toEqual([
      [{ start: 0, end: 13, kind: "hint" }],
      [{ start: 0, end: 3, kind: "main" }],
      [{ start: 0, end: 4, kind: "main" }],
    ]);
  });

  it("drops hints that are not found", () => {
    const marks = locateMarks(null, [hint("Hiring in India")], posting);
    expect(marks).toEqual({ title: [], locations: [[], []], description: [] });
  });
});

describe("sectionLabel", () => {
  it("lowercases, collapses spaces and caps long names at 24 characters", () => {
    expect(sectionLabel("Locations")).toBe("locations");
    expect(sectionLabel("  Location &   Travel ")).toBe("location & travel");
    const long = sectionLabel("What you'll get: Benefits and Perks at Flexport");
    expect(long).toBe("what you'll get: benefi…");
    expect(long.length).toBe(24);
    expect(sectionLabel("")).toBe("posting");
  });
});

describe("markSegments", () => {
  const text = "One two three four five";

  it("cuts the text into plain and marked runs, in text order", () => {
    expect(
      markSegments(text, [
        { start: 14, end: 18, kind: "hint" },
        { start: 4, end: 7, kind: "main" },
      ]),
    ).toEqual([
      { text: "One ", kind: null },
      { text: "two", kind: "main" },
      { text: " three ", kind: null },
      { text: "four", kind: "hint" },
      { text: " five", kind: null },
    ]);
  });

  it("an earlier mark wins over a later one that overlaps it", () => {
    expect(
      markSegments(text, [
        { start: 4, end: 13, kind: "main" },
        { start: 8, end: 18, kind: "hint" },
        { start: 4, end: 13, kind: "hint" },
      ]),
    ).toEqual([
      { text: "One ", kind: null },
      { text: "two three", kind: "main" },
      { text: " four five", kind: null },
    ]);
  });

  it("no marks -> the whole text", () => {
    expect(markSegments(text, [])).toEqual([{ text, kind: null }]);
  });
});
