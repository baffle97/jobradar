import { describe, expect, it } from "vitest";
import { nextTheme, parseThemeCookie, safeRedirect } from "./theme";

describe("theme cookie", () => {
  it("parses a valid theme and defaults to system", () => {
    expect(parseThemeCookie("session=abc; theme=dark")).toBe("dark");
    expect(parseThemeCookie("theme=light")).toBe("light");
    expect(parseThemeCookie("theme=neon")).toBe("system");
    expect(parseThemeCookie(null)).toBe("system");
    expect(parseThemeCookie("xtheme=dark")).toBe("system");
  });
  it("cycles system -> light -> dark", () => {
    expect(nextTheme("system")).toBe("light");
    expect(nextTheme("light")).toBe("dark");
    expect(nextTheme("dark")).toBe("system");
  });
  it("only redirects to same-site paths", () => {
    expect(safeRedirect("/jobs/3?x=1")).toBe("/jobs/3?x=1");
    expect(safeRedirect("//evil.com")).toBe("/");
    expect(safeRedirect("https://evil.com")).toBe("/");
    expect(safeRedirect(null)).toBe("/");
  });
});
