import { describe, expect, it } from "vitest";
import { posting } from "./test-helpers";
import { quoteIsInPosting } from "./verify";

const p = posting({
  title: "Senior Backend Engineer (Remote)",
  locations: ["Remote - US", "Bengaluru, India"],
  description:
    "About us\n\nWe build payments infrastructure.\n\n" +
    "Requirements:\n - Candidates must be located in the United States\n" +
    " - 5+ years   of Go\n\nPerks: home office budget.",
});

describe("quoteIsInPosting", () => {
  it("finds an exact substring of the description", () => {
    expect(quoteIsInPosting("We build payments infrastructure.", p)).toBe(true);
  });

  it("ignores case", () => {
    expect(quoteIsInPosting("WE BUILD PAYMENTS INFRASTRUCTURE", p)).toBe(true);
  });

  it("collapses whitespace on both sides (newlines, runs of spaces, nbsp)", () => {
    expect(quoteIsInPosting("Candidates must be located in the United States", p)).toBe(true);
    expect(quoteIsInPosting("5+ years of Go", p)).toBe(true);
    expect(quoteIsInPosting("Requirements: - Candidates", p)).toBe(true);
    expect(quoteIsInPosting("  we build   payments\ninfrastructure ", p)).toBe(true);
  });

  it("searches the title", () => {
    expect(quoteIsInPosting("Senior Backend Engineer (Remote)", p)).toBe(true);
  });

  it("searches each location string", () => {
    expect(quoteIsInPosting("Remote - US", p)).toBe(true);
    expect(quoteIsInPosting("bengaluru, india", p)).toBe(true);
  });

  it("rejects paraphrases", () => {
    expect(quoteIsInPosting("Candidates must live in the US", p)).toBe(false);
    expect(quoteIsInPosting("US-only remote role", p)).toBe(false);
    expect(quoteIsInPosting("We build payment infrastructure.", p)).toBe(false);
  });

  it("rejects quotes stitched from two places in the description", () => {
    expect(
      quoteIsInPosting("We build payments infrastructure. Perks: home office budget.", p),
    ).toBe(false);
  });

  it("rejects quotes stitched across fields (title/locations/description)", () => {
    // Joining the fields with a space must not create matches that are not in
    // any single field.
    expect(quoteIsInPosting("Remote - US Bengaluru, India", p)).toBe(false);
    expect(quoteIsInPosting("Remote - US, Bengaluru", p)).toBe(false);
    expect(quoteIsInPosting("(Remote) Remote - US", p)).toBe(false);
    expect(quoteIsInPosting("Bengaluru, India About us", p)).toBe(false);
  });

  it("rejects empty and whitespace-only quotes", () => {
    expect(quoteIsInPosting("", p)).toBe(false);
    expect(quoteIsInPosting("   \n ", p)).toBe(false);
  });
});
