/** The in-app data-quality report must agree with the notebook's own checks (§2.4). */
import { describe, expect, it } from "vitest";
import part2 from "@/data/part2.json";
import series from "@/data/series.json";
import { seriesQuality } from "@/lib/data/quality";

describe("seriesQuality on the reference FRED series", () => {
  const q = seriesQuality(series.fred_monthly);

  it("finds no missing values, no duplicates and a regular monthly frequency", () => {
    expect(q.rows).toBe(177);
    expect(q.missing).toBe(part2.series.quality.missing);
    expect(q.duplicates).toBe(part2.series.quality.duplicates);
    expect(q.frequency).toBe(part2.series.quality.frequency);
    expect([q.missing, q.duplicates, q.frequency]).toEqual([0, 0, "MS"]);
    expect(q.gaps).toEqual([]);
  });

  it("reproduces the notebook's four largest year-on-year moves", () => {
    const expected = [
      { month: "2025-07", abs_yoy_pct: 15.6 },
      { month: "2025-06", abs_yoy_pct: 13.8 },
      { month: "2025-08", abs_yoy_pct: 12.3 },
      { month: "2016-09", abs_yoy_pct: 12.2 },
    ];
    expect(part2.series.quality.largest_yoy_moves).toEqual(expected);
    expect(q.largestYoyMoves.map((m) => ({ month: m.month, abs_yoy_pct: m.absYoyPct }))).toEqual(expected);
  });

  it("matches the notebook's min / max / mean", () => {
    expect(Math.round(q.min * 100) / 100).toBe(part2.series.stats.min);
    expect(Math.round(q.max * 100) / 100).toBe(part2.series.stats.max);
    expect(Math.round(q.mean * 100) / 100).toBe(part2.series.stats.mean);
  });
});

describe("seriesQuality edge cases", () => {
  it("reports gaps, duplicates and missing values", () => {
    const q = seriesQuality([
      { month: "2024-01", value: 1 },
      { month: "2024-02", value: null },
      { month: "2024-02", value: 2 },
      { month: "2024-05", value: 5 },
    ]);
    expect(q.missing).toBe(1);
    expect(q.duplicates).toBe(1);
    expect(q.gaps).toEqual(["2024-03", "2024-04"]);
    expect(q.frequency).toBe("irregular");
  });

  it("rejects an empty series", () => {
    expect(() => seriesQuality([])).toThrow();
  });
});
