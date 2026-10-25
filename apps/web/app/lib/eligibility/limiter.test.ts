import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { limiter } from "./task";

vi.mock("~/db", () => ({ db: {}, schema: {} }));

describe("limiter", () => {
  beforeEach(() => vi.useFakeTimers({ now: 0 }));
  afterEach(() => vi.useRealTimers());

  it("starts calls at least intervalMs apart", async () => {
    const run = limiter(2, 1000);
    const starts: number[] = [];
    const call = () => run(async () => starts.push(Date.now()));
    const all = Promise.all([call(), call(), call()]);
    await vi.advanceTimersByTimeAsync(5000);
    await all;
    expect(starts).toEqual([0, 1000, 2000]);
  });

  it("never runs more than size at once", async () => {
    const run = limiter(1);
    let active = 0;
    let peak = 0;
    const call = () =>
      run(async () => {
        peak = Math.max(peak, ++active);
        await new Promise((r) => setTimeout(r, 10));
        active--;
      });
    const all = Promise.all([call(), call(), call()]);
    await vi.advanceTimersByTimeAsync(100);
    await all;
    expect(peak).toBe(1);
  });
});
