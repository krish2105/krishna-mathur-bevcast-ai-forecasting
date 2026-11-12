import { describe, expect, it } from "vitest";
import part2 from "@/data/part2.json";
import series from "@/data/series.json";
import { addMonths, nextMonths } from "@/lib/forecasting/dates";
import {
  FUTURE_HORIZON,
  chronologicalSplit,
  empiricalIntervals,
  rollingOriginBacktest,
  runEngine,
} from "@/lib/forecasting/evaluate";
import { MODEL_IDS, MODELS, type ModelId } from "@/lib/forecasting/models";

const fred = {
  months: series.fred_monthly.map((p) => p.month),
  values: series.fred_monthly.map((p) => p.value),
};
const categoryIndex = part2.seasonal_index.map((r) => r.index);

describe("dates", () => {
  it("derives the forecast months from the last observation, across year ends", () => {
    expect(nextMonths("2026-09", 3)).toEqual(["2026-10", "2026-11", "2026-12"]);
    expect(nextMonths("2025-11", 3)).toEqual(["2025-12", "2026-01", "2026-02"]);
    expect(addMonths("2024-01", -1)).toBe("2023-12");
  });
});

describe("chronological split", () => {
  it("is ordered, disjoint and complete (no leakage)", () => {
    const { train, test } = chronologicalSplit(fred, 12);
    expect(train.values.length + test.values.length).toBe(fred.values.length);
    expect(train.months.at(-1)! < test.months[0]).toBe(true);
    expect(new Set([...train.months, ...test.months]).size).toBe(fred.months.length);
    expect(addMonths(train.months.at(-1)!, 1)).toBe(test.months[0]);
  });

  it("rejects impossible horizons", () => {
    expect(() => chronologicalSplit(fred, 0)).toThrow();
    expect(() => chronologicalSplit(fred, fred.values.length)).toThrow();
  });
});

describe("leakage", () => {
  const evaluated: ModelId[] = MODEL_IDS;

  it("hold-out forecasts do not change when the hidden test values change", () => {
    const opts = { models: evaluated, testHorizon: 12, origins: 6, categoryIndex };
    const a = runEngine(fred, opts);
    const tampered = { months: fred.months, values: fred.values.map((v, i) => (i >= fred.values.length - 12 ? v * 3 : v)) };
    const b = runEngine(tampered, opts);
    for (const id of evaluated) {
      const ra = a.runs.find((r) => r.id === id)!;
      const rb = b.runs.find((r) => r.id === id)!;
      expect(ra.status, `${id}: ${ra.reason}`).toBe("evaluated");
      expect(rb.holdout!.forecast).toEqual(ra.holdout!.forecast);
    }
  });

  it("each backtest forecast only uses data up to its origin", () => {
    for (const id of ["naive", "seasonal-naive", "ridge-lags", "si-transfer"] as ModelId[]) {
      const pts = rollingOriginBacktest(fred, id, 4, 3, categoryIndex);
      for (const p of pts.filter((q) => q.h === 1)) {
        const cut = fred.months.indexOf(p.origin) + 1;
        const fc = MODELS[id].forecast(fred.values.slice(0, cut), 3, { months: fred.months.slice(0, cut), categoryIndex });
        expect(fc[0]).toBeCloseTo(p.forecast, 10);
        expect(p.target > p.origin).toBe(true);
      }
    }
  });
});

describe("engine on the reference series", () => {
  const res = runEngine(fred, { models: MODEL_IDS, testHorizon: 12, origins: 18, categoryIndex });

  it("forecasts exactly 3 future months after the last observation", () => {
    expect(FUTURE_HORIZON).toBe(3);
    expect(res.futureMonths).toEqual(["2026-10", "2026-11", "2026-12"]);
    for (const r of res.runs.filter((x) => x.status === "evaluated")) {
      expect(r.future!.forecast).toHaveLength(3);
      expect(r.future!.months).toEqual(res.futureMonths);
    }
  });

  it("prediction intervals are ordered and have positive width", () => {
    for (const r of res.runs.filter((x) => x.status === "evaluated")) {
      r.future!.intervals.forEach((iv) => {
        expect(iv.high80 - iv.low80).toBeGreaterThan(0);
        expect(iv.low95).toBeLessThanOrEqual(iv.low80);
        expect(iv.high95).toBeGreaterThanOrEqual(iv.high80);
      });
    }
  });

  it("Holt-Winters and ridge give sensible accuracy on the real series", () => {
    for (const id of ["holt-winters-add", "holt-winters-mul", "ridge-lags"]) {
      const r = res.runs.find((x) => x.id === id)!;
      expect(r.status).toBe("evaluated");
      expect(r.backtest!.metrics.wape!).toBeLessThan(5);
      expect(r.holdout!.metrics.wape!).toBeLessThan(6);
    }
  });

  it("uses 54 pooled backtest forecasts and picks a best model", () => {
    expect(res.runs.find((r) => r.id === "naive")!.backtest!.points).toHaveLength(54);
    expect(res.best).toBeDefined();
  });
});

describe("short uploads (≤ 24 months)", () => {
  it("warns, disables two-cycle seasonal models and still forecasts 3 months", () => {
    const short = { months: fred.months.slice(-18), values: fred.values.slice(-18) };
    const res = runEngine(short, { models: MODEL_IDS, testHorizon: 3, origins: 6, categoryIndex });
    expect(res.warnings.join(" ")).toMatch(/seasonality cannot be estimated reliably/);
    expect(res.runs.find((r) => r.id === "holt-winters-add")!.status).toBe("not-run");
    expect(res.runs.find((r) => r.id === "si-transfer")!.status).toBe("evaluated");
    expect(res.futureMonths).toEqual(["2026-10", "2026-11", "2026-12"]);
  });
});

describe("empirical intervals", () => {
  it("fall back to a positive band when the errors have no spread", () => {
    const iv = empiricalIntervals([100, 100, 100], [
      { origin: "2024-01", target: "2024-02", h: 1, actual: 100, forecast: 100 },
    ]);
    iv.forEach((x) => expect(x.high80 - x.low80).toBeGreaterThan(0));
  });
});
