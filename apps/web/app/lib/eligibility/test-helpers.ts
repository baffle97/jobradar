// Shared helpers for the eligibility tests. Not a test file itself.

import rawFixtures from "./__fixtures__/real-postings.json";
import type { Posting } from "./types";

export type ExpectedByRules = "eligible" | "not_eligible" | null;

export interface RealFixture {
  id: number;
  source: string;
  posting: Posting;
  expectedByRules: ExpectedByRules;
  expectedQuote: string | null;
  why: string;
  // "tester-agent-draft": labelled by the tester agent from the spec, NOT
  // hand-labelled by the user. Re-check before treating them as ground truth.
  labelledBy: string;
}

export const realFixtures = rawFixtures as RealFixture[];

export function posting(overrides: Partial<Posting> = {}): Posting {
  return {
    title: "Software Engineer",
    company: "Acme",
    locations: ["Remote"],
    workMode: "remote",
    description: "We build things.",
    ...overrides,
  };
}

// Independent of ./verify, so fixture sanity checks run before the module
// exists. Same normalisation the spec describes: collapse whitespace, ignore case.
export function collapse(s: string): string {
  return s.replace(/\s+/g, " ").trim().toLowerCase();
}
