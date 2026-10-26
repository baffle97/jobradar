import { describe, expect, it } from "vitest";
import { annualAmount, formatInrPerMonth, INR_PER, inrPerMonth } from "./pay";

const job = (
  salaryMin: number | null,
  salaryMax: number | null,
  salaryCurrency: string | null,
) => ({
  salaryMin,
  salaryMax,
  salaryCurrency,
  salaryText: null,
});

describe("inrPerMonth", () => {
  it("uses the top of the range, yearly figures over 12", () => {
    expect(inrPerMonth(job(100_000, 120_000, "USD"))).toBeCloseTo((120_000 * INR_PER.USD) / 12);
  });

  it("falls back to the one figure there is", () => {
    expect(inrPerMonth(job(60_000, null, "EUR"))).toBeCloseTo((60_000 * INR_PER.EUR) / 12);
  });

  it("treats figures under 1000 as hourly (2080 hours a year)", () => {
    expect(annualAmount(40)).toBe(83_200);
    expect(inrPerMonth(job(40, 40, "USD"))).toBeCloseTo((83_200 * INR_PER.USD) / 12);
  });

  it("an INR range is already in rupees; currency case does not matter", () => {
    expect(inrPerMonth(job(null, 4_800_000, "inr"))).toBe(400_000);
  });

  it("null with no figure, a zero figure or an unknown currency", () => {
    expect(inrPerMonth(job(null, null, "USD"))).toBeNull();
    expect(inrPerMonth(job(50, 0, "USD"))).toBeNull();
    expect(inrPerMonth(job(100_000, 120_000, null))).toBeNull();
    expect(inrPerMonth(job(100_000, 120_000, "XYZ"))).toBeNull();
  });
});

describe("formatInrPerMonth", () => {
  it("lakh with one decimal under 10L, whole lakh above, thousands below 1L", () => {
    expect(formatInrPerMonth(420_000)).toBe("≈ ₹4.2L/mo");
    expect(formatInrPerMonth(1_234_567)).toBe("≈ ₹12L/mo");
    expect(formatInrPerMonth(85_400)).toBe("≈ ₹85k/mo");
  });
});
