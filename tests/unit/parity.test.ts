/**
 * Parity with the executed notebook: the TypeScript Naïve and Seasonal Naïve (and the seasonal-index
 * transfer) must reproduce the notebook's numbers on the same FRED series, exactly to two decimals.
 */
import { describe, expect, it } from "vitest";
import part2 from "@/data/part2.json";
import series from "@/data/series.json";
import { chronologicalSplit, rollingOriginBacktest } from "@/lib/forecasting/evaluate";
import { naive, seasonalIndexTransfer, seasonalNaive } from "@/lib/forecasting/models";
import { scoreAll } from "@/lib/metrics";

const fred = {
  months: series.fred_monthly.map((p) => p.month),
  values: series.fred_monthly.map((p) => p.value),
};
const nbScore = (model: string, table: { model: string; mape: number; wape: number; rmse: number; bias_pct: number }[]) =>
  table.find((r) => r.model === model)!;
const r2 = (x: number | null) => Math.round((x as number) * 100) / 100;

describe("reference series", () => {
  it("is the notebook window: Jan 2012 – Sep 2026, 177 months", () => {
    expect(fred.months[0]).toBe("2012-01");
    expect(fred.months.at(-1)).toBe("2026-09");
    expect(fred.values).toHaveLength(177);
  });
});

describe("12-month hold-out parity (Oct 2025 – Sep 2026)", () => {
  const { train, test } = chronologicalSplit(fred, 12);

  it("test window matches the notebook", () => {
    expect(test.months[0]).toBe("2025-10");
    expect(test.months.at(-1)).toBe("2026-09");
  });

  it("Naïve: MAPE 2.64, WAPE 2.59, RMSE 3.10, bias 2.30", () => {
    const s = scoreAll(test.values, naive(train.values, 12));
    expect([r2(s.mape), r2(s.wape), r2(s.rmse), r2(s.biasPct)]).toEqual([2.64, 2.59, 3.1, 2.3]);
    const nb = nbScore("Naïve", part2.holdout.scores);
    expect([r2(s.mape), r2(s.wape), r2(s.rmse), r2(s.biasPct)]).toEqual([nb.mape, nb.wape, nb.rmse, nb.bias_pct]);
  });

  it("Seasonal Naïve: MAPE 2.66, WAPE 2.64, RMSE 3.08, bias 1.37", () => {
    const s = scoreAll(test.values, seasonalNaive(train.values, 12));
    expect([r2(s.mape), r2(s.wape), r2(s.rmse), r2(s.biasPct)]).toEqual([2.66, 2.64, 3.08, 1.37]);
    const nb = nbScore("Seasonal Naïve", part2.holdout.scores);
    expect([r2(s.mape), r2(s.wape)]).toEqual([nb.mape, nb.wape]);
  });

  it("per-month forecasts equal the notebook's test table", () => {
    const n = naive(train.values, 12);
    const sn = seasonalNaive(train.values, 12);
    series.test_forecasts.forEach((row, i) => {
      expect(n[i]).toBeCloseTo(row["Naïve"], 4);
      expect(sn[i]).toBeCloseTo(row["Seasonal Naïve"], 4);
    });
  });
});

describe("rolling-origin backtest parity (18 origins × 3 months = 54 forecasts)", () => {
  it("Naïve 2.28 / 2.28 and Seasonal Naïve 6.10 / 6.08 (MAPE / WAPE)", () => {
    const bn = rollingOriginBacktest(fred, "naive", 18, 3);
    const bs = rollingOriginBacktest(fred, "seasonal-naive", 18, 3);
    expect(bn).toHaveLength(54);
    const sn = scoreAll(bn.map((p) => p.actual), bn.map((p) => p.forecast));
    const ss = scoreAll(bs.map((p) => p.actual), bs.map((p) => p.forecast));
    expect([r2(sn.mape), r2(sn.wape)]).toEqual([2.28, 2.28]);
    expect([r2(ss.mape), r2(ss.wape)]).toEqual([6.1, 6.08]);
  });

  it("every backtest forecast equals the notebook's, origin by origin", () => {
    const bn = rollingOriginBacktest(fred, "naive", 18, 3);
    const bs = rollingOriginBacktest(fred, "seasonal-naive", 18, 3);
    series.backtest_detail.forEach((row, i) => {
      expect(bn[i].origin).toBe(row.origin);
      expect(bn[i].target).toBe(row.target);
      expect(bn[i].forecast).toBeCloseTo(row["Naïve"], 4);
      expect(bs[i].forecast).toBeCloseTo(row["Seasonal Naïve"], 4);
    });
  });
});

describe("first-year-only scenario parity (category seasonal-index transfer)", () => {
  it("reproduces the notebook's forecasts and WAPE 1.76", () => {
    const hist = series.first_year.history;
    const idx = part2.first_year.category_seasonal_index.map((r) => r.index);
    const fc = seasonalIndexTransfer(hist.map((p) => p.value), hist.map((p) => p.month), 12, idx);
    const key = "Seasonal-index transfer (first year + category pattern)";
    series.first_year.forecasts.forEach((row, i) => expect(fc[i]).toBeCloseTo(row[key], 3));
    const s = scoreAll(series.first_year.forecasts.map((r) => r.actual), fc);
    expect(r2(s.wape)).toBe(1.76);
  });
});
