import { describe, expect, it } from "vitest";
import { formatSalary } from "./salary";

const base = { salaryMin: null, salaryMax: null, salaryCurrency: null, salaryText: null };

describe("formatSalary", () => {
  it("returns null when there is no salary", () => {
    expect(formatSalary(base)).toBeNull();
  });
  it("falls back to short board wording and drops extras", () => {
    expect(
      formatSalary({ ...base, salaryText: "$150K – $200K • Offers Equity", salaryCurrency: "USD" }),
    ).toEqual({ text: "$150K – $200K", context: "US range" });
    expect(
      formatSalary({ ...base, salaryText: "On-target Earnings OR Base Salary range (SF)" }),
    ).toBeNull();
  });
  it("prefers parsed numbers over long board wording", () => {
    expect(
      formatSalary({
        ...base,
        salaryMin: 252000,
        salaryMax: 296000,
        salaryCurrency: "USD",
        salaryText:
          "On-target Earnings OR Base Salary range (San Francisco, CA): USD 252,000 - 296,000",
      }),
    ).toEqual({ text: "$252k – $296k", context: "US range" });
  });
  it("reads rupee ranges in lakh a year", () => {
    expect(
      formatSalary({ ...base, salaryMin: 6_622_000, salaryMax: 9_657_000, salaryCurrency: "INR" }),
    ).toEqual({ text: "₹66L – ₹97L", context: "India range" });
  });
  it("formats structured ranges with a residency context", () => {
    expect(
      formatSalary({ ...base, salaryMin: 70000, salaryMax: 90000, salaryCurrency: "EUR" }),
    ).toEqual({ text: "€70k – €90k", context: "EU range" });
    expect(formatSalary({ ...base, salaryMin: 36, salaryMax: 43, salaryCurrency: "usd" })).toEqual({
      text: "$36/hr – $43/hr",
      context: "US range",
    });
  });
  it("says when the currency is unknown", () => {
    expect(formatSalary({ ...base, salaryMax: 120000 })?.context).toBe("currency not stated");
    expect(formatSalary({ ...base, salaryMin: 5, salaryCurrency: "SEK" })).toEqual({
      text: "SEK 5/hr",
      context: "SEK range",
    });
  });
});
