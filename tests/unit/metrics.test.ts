import { describe, expect, it } from "vitest";
import { biasPct, mape, rmse, scoreAll, wape } from "@/lib/metrics";

describe("metrics: hand examples", () => {
  it("MAPE([100,200],[90,220]) = 10 and WAPE = 10 (same check as the notebook)", () => {
    expect(mape([100, 200], [90, 220]).value).toBeCloseTo(10, 12);
    expect(wape([100, 200], [90, 220])).toBeCloseTo(10, 12);
  });

  it("WAPE is not the average of the monthly percentage errors", () => {
    // a 100% miss on a tiny month dominates MAPE but barely moves WAPE
    const a = [10, 1000];
    const f = [20, 1000];
    expect(mape(a, f).value).toBeCloseTo(50, 12);
    expect(wape(a, f)).toBeCloseTo((10 / 1010) * 100, 12);
  });

  it("RMSE and bias", () => {
    expect(rmse([100, 200], [90, 220])).toBeCloseTo(Math.sqrt((100 + 400) / 2), 12);
    expect(biasPct([100, 200], [90, 220])).toBeCloseTo((10 / 300) * 100, 12); // over-forecast is positive
    expect(biasPct([100, 100], [90, 90])).toBeCloseTo(-10, 12);
  });
});

describe("metrics: zero actuals", () => {
  it("MAPE excludes zero actuals and reports how many", () => {
    const r = mape([0, 100, 0], [5, 110, 3]);
    expect(r.value).toBeCloseTo(10, 12);
    expect(r.excluded).toBe(2);
    expect(r.used).toBe(1);
  });

  it("MAPE is null when every actual is zero", () => {
    expect(mape([0, 0], [1, 2])).toEqual({ value: null, excluded: 2, used: 0 });
  });

  it("WAPE keeps zero-actual months in both sums", () => {
    expect(wape([0, 100], [5, 110])).toBeCloseTo(15, 12);
  });

  it("WAPE is undefined (null) when the sum of actuals is 0", () => {
    expect(wape([0, 0], [1, 2])).toBeNull();
  });

  it("scoreAll returns every metric", () => {
    const s = scoreAll([0, 100], [5, 110]);
    expect(s.mapeExcluded).toBe(1);
    expect(s.n).toBe(2);
  });
});

describe("metrics: input validation", () => {
  it("throws on length mismatch, empty input and non-finite values", () => {
    expect(() => mape([1, 2], [1])).toThrow(/Length mismatch/);
    expect(() => wape([], [])).toThrow(/No values/);
    expect(() => rmse([1, Number.NaN], [1, 2])).toThrow(/Non-finite/);
  });
});
