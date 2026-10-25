import { describe, expect, it } from "vitest";
import { formatAge, formatCount, formatDay, isNew, jobDate } from "./format";

const NOW = "2026-10-25T13:00:00.000Z";

describe("jobDate", () => {
  it("prefers postedAt and falls back to createdAt", () => {
    expect(jobDate({ postedAt: "2026-09-23T04:47:03-04:00", createdAt: NOW })).toBe(
      "2026-09-23T04:47:03-04:00",
    );
    expect(jobDate({ postedAt: null, createdAt: NOW })).toBe(NOW);
    expect(jobDate({ postedAt: "not a date", createdAt: NOW })).toBe(NOW);
  });
});

describe("formatAge", () => {
  it("gives minutes, hours and days", () => {
    expect(formatAge("2026-10-25T12:20:00Z", NOW)).toBe("40m ago");
    expect(formatAge("2026-10-25T10:00:00Z", NOW)).toBe("3h ago");
    expect(formatAge("2026-10-20T13:00:00Z", NOW)).toBe("5d ago");
  });
  it("treats future timestamps as just now", () => {
    expect(formatAge("2026-10-25T14:00:00Z", NOW)).toBe("just now");
  });
  it("switches to an IST date after two weeks", () => {
    // 20:00 UTC on 1 Oct is already 2 Oct in India.
    expect(formatAge("2026-10-01T20:00:00Z", NOW)).toBe("2 Oct");
    expect(formatAge("2025-12-30T10:00:00Z", NOW)).toBe("30 Dec 2025");
  });
  it("returns empty text for unparseable dates", () => {
    expect(formatAge("", NOW)).toBe("");
  });
});

describe("formatDay", () => {
  it("formats in IST without depending on the machine's time zone", () => {
    expect(formatDay("2026-10-25T19:00:00Z", NOW)).toBe("26 Oct");
    expect(formatDay("2026-10-25T19:00:00Z")).toBe("26 Oct 2026");
  });
});

describe("isNew", () => {
  it("is true within 48 hours", () => {
    expect(isNew("2026-10-24T00:00:00Z", NOW)).toBe(true);
    expect(isNew("2026-10-20T00:00:00Z", NOW)).toBe(false);
  });
});

describe("formatCount", () => {
  it("adds thousands separators", () => {
    expect(formatCount(0)).toBe("0");
    expect(formatCount(2775)).toBe("2,775");
    expect(formatCount(1234567)).toBe("1,234,567");
  });
});
