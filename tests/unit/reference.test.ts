/** The exported JSON must carry exactly the reference numbers of the executed notebook (brief §4.1). */
import { describe, expect, it } from "vitest";
import part1 from "@/data/part1.json";
import part2 from "@/data/part2.json";

const by = <T extends { model: string }>(rows: T[]) => Object.fromEntries(rows.map((r) => [r.model, r]));

describe("Part 1 reference numbers", () => {
  it("demand series and correlation", () => {
    expect(part1.monthly.map((m) => m.demand)).toEqual([80, 95, 130, 160, 180, 200, 220, 210, 170, 140, 110, 90]);
    expect(part1.correlation).toBe(0.909);
  });
  it("Naïve Feb–Dec 17.35 / 15.84 and in-sample RF 8.51 / 7.76", () => {
    expect([part1.naive.mape, part1.naive.wape]).toEqual([17.35, 15.84]);
    const rf = part1.in_sample.scores.find((s) => s.model.startsWith("Random Forest"))!;
    expect([rf.mape, rf.wape]).toEqual([8.51, 7.76]);
  });
  it("walk-forward Jul–Dec table and units mis-planned", () => {
    const s = by(part1.walk_forward.scores);
    expect([s["Weather-adjusted regression"].mape, s["Weather-adjusted regression"].wape]).toEqual([12.0, 11.98]);
    expect([s["Naïve"].mape, s["Naïve"].wape]).toEqual([18.05, 15.96]);
    expect([s["Random Forest (lags + temp)"].mape, s["Random Forest (lags + temp)"].wape]).toEqual([29.5, 23.57]);
    expect([s["Random Forest (lags)"].mape, s["Random Forest (lags)"].wape]).toEqual([31.38, 25.23]);
    expect(Object.fromEntries(part1.impact.rows.map((r) => [r.model, r.total_units]))).toEqual({
      "Weather-adjusted regression": 112.6,
      "Naïve": 150,
      "Random Forest (lags + temp)": 221.6,
      "Random Forest (lags)": 237.2,
    });
  });
});

describe("Part 2 reference numbers", () => {
  it("series window and SARIMA order", () => {
    expect(part2.series.window).toEqual({ from: "2012-01", to: "2026-09", n_months: 177 });
    expect(part2.sarima.label).toBe("SARIMA(1, 1, 2)x(1, 1, 1, 12)");
  });
  it("hold-out and backtest WAPE", () => {
    const h = by(part2.holdout.scores);
    const b = by(part2.backtest.scores);
    expect(["XGBoost", "Holt-Winters", "Random Forest", "Naïve", "Seasonal Naïve", "SARIMA"].map((m) => h[m].wape)).toEqual([1.57, 1.71, 2.22, 2.59, 2.64, 2.73]);
    expect(["XGBoost", "Naïve", "Random Forest", "SARIMA", "Holt-Winters", "Seasonal Naïve"].map((m) => b[m].wape)).toEqual([2.14, 2.28, 2.29, 2.39, 2.68, 6.08]);
    expect(part2.best_model).toBe("XGBoost");
  });
  it("next 3 months (XGBoost) and SARIMA 95% intervals", () => {
    const r2 = (x: number) => Math.round(x * 100) / 100;
    const r1 = (x: number) => Math.round(x * 10) / 10;
    expect(part2.future.rows.map((r) => r.month)).toEqual(["2026-10", "2026-11", "2026-12"]);
    expect(part2.future.rows.map((r) => r2(r.XGBoost as number))).toEqual([95.3, 94.93, 93.53]);
    expect(part2.future.rows.map((r) => r.sarima_pi95.map(r1))).toEqual([
      [89.7, 98.1],
      [86.5, 97.2],
      [84.6, 96.5],
    ]);
  });
  it("first-year-only scenario", () => {
    expect(part2.first_year.scores.map((s) => s.wape)).toEqual([1.76, 2.13, 2.59]);
  });
});
