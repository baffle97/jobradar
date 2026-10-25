import { describe, expect, it } from "vitest";
import { fnv1a, pickNext, stratifiedOrder } from "./sampling";

function make(n: number, source: string, verdict: string, offset: number) {
  return Array.from({ length: n }, (_, i) => ({ id: offset + i, source, verdict }));
}

const items = [
  ...make(50, "greenhouse", "not_eligible", 1),
  ...make(3, "ashby", "eligible", 100),
  ...make(10, "hn", "unclear", 200),
];

describe("fnv1a", () => {
  it("is stable", () => {
    expect(fnv1a("abc")).toBe(fnv1a("abc"));
    expect(fnv1a("abc")).not.toBe(fnv1a("abd"));
  });
});

describe("stratifiedOrder", () => {
  it("keeps every item exactly once", () => {
    const order = stratifiedOrder(items);
    expect(order).toHaveLength(items.length);
    expect(new Set(order.map((x) => x.id)).size).toBe(items.length);
  });

  it("interleaves groups so rare verdicts come early", () => {
    const first9 = stratifiedOrder(items).slice(0, 9);
    expect(first9.filter((x) => x.verdict === "eligible")).toHaveLength(3);
    expect(first9.filter((x) => x.source === "hn")).toHaveLength(3);
  });

  it("does not depend on input order", () => {
    const a = stratifiedOrder(items).map((x) => x.id);
    const b = stratifiedOrder(items.slice().reverse()).map((x) => x.id);
    expect(b).toEqual(a);
  });
});

describe("pickNext", () => {
  const order = stratifiedOrder(items);

  it("returns the first unlabelled item at or after `from`", () => {
    expect(pickNext(order, new Set(), 0)?.position).toBe(0);
    const labelled = new Set([order[0].id, order[1].id]);
    expect(pickNext(order, labelled, 0)?.position).toBe(2);
    expect(pickNext(order, labelled, 5)?.position).toBe(5);
  });

  it("wraps around to bring skipped items back", () => {
    const labelled = new Set(order.slice(3).map((x) => x.id));
    expect(pickNext(order, labelled, 10)?.position).toBe(0);
  });

  it("returns null when everything is labelled", () => {
    expect(pickNext(order, new Set(order.map((x) => x.id)), 0)).toBeNull();
    expect(pickNext([], new Set(), 0)).toBeNull();
  });
});
