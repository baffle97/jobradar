// Posted pay in rupees a month, so a range can be held against a monthly goal
// ("₹3L+ a month"). Uses the top of the posted range: what the role can pay,
// for the place the range is written for (often the US, not India).
import type { SalaryLike } from "./salary";

// Rupees per unit: ECB reference rates via api.frankfurter.dev, 2026-10-23.
// Refresh by hand now and then; a few percent off does not move a lakh bucket.
export const RATES_DATE = "2026-10-23";
export const INR_PER: Record<string, number> = {
  INR: 1,
  USD: 94.94,
  EUR: 106.27,
  GBP: 126.92,
  CHF: 115.17,
  CAD: 67.84,
  AUD: 66.67,
  SGD: 74.26,
  PLN: 24.18,
  BRL: 18.81,
  JPY: 0.6055,
  KRW: 0.07169,
};

// Figures under 1000 are hourly rates (as in salary.ts); a full-time year is 2080 hours.
export const HOURS_PER_YEAR = 2080;

export function annualAmount(value: number): number {
  return value < 1000 ? value * HOURS_PER_YEAR : value;
}

// Choices for the feed's `min` filter, in lakh rupees a month.
export const MIN_PAY = [2, 3, 4, 6] as const;
export type MinPay = (typeof MIN_PAY)[number];

export const LAKH = 100_000;

export function minPayLabel(lakh: MinPay): string {
  return `Pays ₹${lakh}L+/month`;
}

// Rupees a month at the top of the range; null when there is no number or the
// currency is unknown.
export function inrPerMonth(job: SalaryLike): number | null {
  const top = job.salaryMax ?? job.salaryMin;
  const rate = INR_PER[job.salaryCurrency?.toUpperCase() ?? ""];
  if (!top || !rate) return null;
  return (annualAmount(top) * rate) / 12;
}

// "≈ ₹4.2L/mo", "≈ ₹85k/mo".
export function formatInrPerMonth(inr: number): string {
  if (inr >= LAKH) {
    const lakh = inr / LAKH;
    return `≈ ₹${lakh >= 10 ? Math.round(lakh) : Math.round(lakh * 10) / 10}L/mo`;
  }
  return `≈ ₹${Math.round(inr / 1000)}k/mo`;
}
