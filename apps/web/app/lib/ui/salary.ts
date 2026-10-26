// Salaries are never shown bare: every figure carries where the range applies,
// so a US range is not read as an offer for someone in India.

const SYMBOLS: Record<string, string> = { USD: "$", EUR: "€", GBP: "£", INR: "₹" };

const CONTEXT: Record<string, string> = {
  USD: "US range",
  EUR: "EU range",
  GBP: "UK range",
  CAD: "Canada range",
  INR: "India range",
  AUD: "Australia range",
  BRL: "Brazil range",
  PLN: "Poland range",
};

export interface SalaryLike {
  salaryMin: number | null;
  salaryMax: number | null;
  salaryCurrency: string | null;
  salaryText: string | null;
}

export interface SalaryDisplay {
  text: string;
  context: string;
}

function amount(value: number, currency: string | null): string {
  const prefix = currency ? (SYMBOLS[currency] ?? `${currency} `) : "";
  // Small numbers on these boards are hourly rates.
  if (value < 1000) return `${prefix}${value}/hr`;
  // Rupee figures read in lakh: ₹66L, not ₹6622k.
  if (currency === "INR" && value >= 100_000) return `${prefix}${Math.round(value / 100_000)}L`;
  return `${prefix}${Math.round(value / 1000)}k`;
}

export function salaryContext(currency: string | null): string {
  if (!currency) return "currency not stated";
  return CONTEXT[currency] ?? `${currency} range`;
}

export function formatSalary(job: SalaryLike): SalaryDisplay | null {
  const currency = job.salaryCurrency?.toUpperCase() || null;
  const context = salaryContext(currency);

  const { salaryMin: min, salaryMax: max } = job;
  if (min && max && min !== max) {
    return { text: `${amount(min, currency)} – ${amount(max, currency)}`, context };
  }
  if (min || max) {
    const v = (min || max) as number;
    return { text: amount(v, currency), context };
  }

  // No numbers parsed: fall back to the board's wording, minus extras like
  // "• Offers Equity", and only when it is short enough to be a figure.
  const text = job.salaryText?.split("•")[0]?.trim();
  if (text && text.length <= 40) return { text, context };
  return null;
}
