import { describe, expect, it } from "vitest";
import { parseSavedStatus, safeReturnTo } from "./saved";

describe("parseSavedStatus", () => {
  it("accepts the five statuses only", () => {
    expect(parseSavedStatus("applied")).toBe("applied");
    expect(parseSavedStatus("remove")).toBeNull();
    expect(parseSavedStatus(null)).toBeNull();
  });
});

describe("safeReturnTo", () => {
  it("keeps a path on this site, with its query and hash", () => {
    expect(safeReturnTo("/?role=ai#job-12")).toBe("/?role=ai#job-12");
  });

  it("refuses anything that could leave the site", () => {
    for (const raw of ["https://evil.example", "//evil.example", "/\\evil.example", "", null, 5]) {
      expect(safeReturnTo(raw)).toBe("/");
    }
    expect(safeReturnTo("javascript:alert(1)", "/pipeline")).toBe("/pipeline");
  });
});
