import { describe, expect, it } from "vitest";
import {
  activeFilters,
  cleanFeedHref,
  clearFiltersHref,
  type FeedParams,
  feedHref,
  feedStep,
  parseFeedParams,
} from "./feed-params";

const parse = (qs: string) => parseFeedParams(new URLSearchParams(qs));
const parseHref = (href: string) => parseFeedParams(new URL(href, "http://x").searchParams);

const DEFAULTS: FeedParams = {
  v: "open",
  q: "",
  n: 20,
  role: null,
  age: null,
  src: null,
  pay: false,
  basis: null,
  sort: "best",
  view: "cards",
};

describe("parseFeedParams", () => {
  it("no params -> today's default view", () => {
    expect(parse("")).toEqual(DEFAULTS);
  });

  it("reads every known value", () => {
    expect(
      parse("v=eligible&q=rust&n=60&role=ai&age=7&src=ats&pay=1&basis=explicit&sort=new&view=list"),
    ).toEqual({
      v: "eligible",
      q: "rust",
      n: 60,
      role: "ai",
      age: 7,
      src: "ats",
      pay: true,
      basis: "explicit",
      sort: "new",
      view: "list",
    });
  });

  it("unknown values fall back to the defaults", () => {
    expect(
      parse("v=maybe&n=abc&role=chef&age=5&src=linkedin&pay=yes&basis=hints&sort=old&view=grid"),
    ).toEqual(DEFAULTS);
  });

  it("clamps n to one step .. 400, and the step depends on the view", () => {
    expect(parse("n=5").n).toBe(20);
    expect(parse("n=9999").n).toBe(400);
    expect(parse("view=list").n).toBe(50);
    expect(parse("view=list&n=30").n).toBe(50);
    expect(feedStep("cards")).toBe(20);
    expect(feedStep("list")).toBe(50);
  });

  it("basis only applies to the eligible and open views", () => {
    expect(parse("v=eligible&basis=explicit").basis).toBe("explicit");
    expect(parse("basis=explicit").basis).toBe("explicit");
    expect(parse("v=not_eligible&basis=explicit").basis).toBeNull();
    expect(parse("v=all&basis=explicit").basis).toBeNull();
  });

  it("trims q and caps it at 100 characters", () => {
    expect(parse("q=%20%20go%20").q).toBe("go");
    expect(parse(`q=${"x".repeat(150)}`).q).toHaveLength(100);
  });
});

describe("feedHref", () => {
  it("the default view is plain /", () => {
    expect(feedHref(DEFAULTS)).toBe("/");
  });

  it("round-trips every param", () => {
    const p = parse(
      "v=eligible&q=rust%20%26%20go&n=150&role=infra&age=30&src=hn&pay=1&basis=explicit&sort=new&view=list",
    );
    expect(parseHref(feedHref(p, { n: p.n }))).toEqual(p);
    for (const qs of ["", "v=all", "role=nontech&view=list", "age=1&pay=1", "src=remotive"]) {
      const q = parse(qs);
      expect(parseHref(feedHref(q, { n: q.n }))).toEqual(q);
    }
  });

  it("a change starts the list from the top again unless n is given", () => {
    const p = parse("role=ai&n=80");
    expect(feedHref(p, { age: 7 })).toBe("/?role=ai&age=7");
    expect(feedHref(p, { n: 100 })).toBe("/?n=100&role=ai");
  });

  it("drops basis when the change leaves the eligible/open views", () => {
    const p = parse("basis=explicit&role=ai");
    expect(feedHref(p, { v: "all" })).toBe("/?v=all&role=ai");
  });
});

describe("activeFilters", () => {
  it("one chip per filter; each × link removes only that filter", () => {
    const p = parse("v=eligible&q=go&role=ai&age=7&pay=1&sort=new&view=list&n=100");
    const chips = activeFilters(p);
    expect(chips.map((c) => c.label)).toEqual(["AI / ML / Agents", "Last 7 days", "Salary listed"]);
    expect(chips[0].href).toBe("/?v=eligible&q=go&age=7&pay=1&sort=new&view=list");
    expect(chips[1].href).toBe("/?v=eligible&q=go&role=ai&pay=1&sort=new&view=list");
  });

  it("labels source and basis chips; sort and view are not filters", () => {
    expect(activeFilters(parse("src=hn&basis=explicit")).map((c) => c.label)).toEqual([
      "Hacker News",
      "Explicit lines only",
    ]);
    expect(activeFilters(parse("sort=new&view=list"))).toEqual([]);
  });

  it("clear all keeps the verdict, search, sort and view", () => {
    expect(
      clearFiltersHref(parse("v=all&q=go&role=ai&age=1&src=ats&pay=1&sort=new&view=list")),
    ).toBe("/?v=all&q=go&sort=new&view=list");
  });
});

describe("cleanFeedHref", () => {
  const clean = (qs: string) => cleanFeedHref(new URLSearchParams(qs));

  it("drops empty and default-valued params (what the no-JS filter form sends)", () => {
    expect(clean("view=list&role=eng&age=&src=&sort=best&pay=1")).toBe(
      "/?role=eng&pay=1&view=list",
    );
    expect(clean("v=open&q=&n=20")).toBe("/");
    expect(clean("role=chef&view=cards")).toBe("/");
    expect(clean("q=%20go%20")).toBe("/?q=go");
    expect(clean("view=list&n=30")).toBe("/?view=list");
  });

  it("null when every param is already clean, in any order", () => {
    expect(clean("")).toBeNull();
    expect(clean("role=ai&view=list")).toBeNull();
    expect(clean("view=list&role=ai")).toBeNull();
    expect(clean("v=all&n=60&sort=new")).toBeNull();
  });

  it("keeps params it does not know (e.g. ?still)", () => {
    expect(clean("still&age=")).toBe("/?still=");
    expect(clean("still")).toBeNull();
  });
});
