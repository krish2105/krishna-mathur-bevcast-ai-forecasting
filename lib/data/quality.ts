/**
 * Data-quality report for a monthly series, computed in the app (same checks as notebook §2.4):
 * missing values, duplicate months, regular monthly frequency and the largest year-on-year moves.
 */
import { addMonths, toIndex } from "@/lib/forecasting/dates";

export interface QualityPoint {
  month: string;
  value: number | null;
}

export interface SeriesQuality {
  rows: number;
  from: string;
  to: string;
  missing: number;
  duplicates: number;
  /** "MS" (regular month-start frequency, pandas notation) or "irregular" */
  frequency: "MS" | "irregular";
  gaps: string[];
  largestYoyMoves: { month: string; absYoyPct: number; yoyPct: number }[];
  min: number;
  max: number;
  mean: number;
}

const round1 = (x: number) => Math.round(x * 10) / 10;

export function seriesQuality(points: readonly QualityPoint[], topN = 4): SeriesQuality {
  if (points.length === 0) throw new Error("Empty series");
  const months = points.map((p) => p.month);
  const sorted = [...months].sort();
  const missing = points.filter((p) => p.value === null || !Number.isFinite(p.value)).length;
  const duplicates = months.length - new Set(months).size;

  const gaps: string[] = [];
  const unique = [...new Set(sorted)];
  for (let i = 1; i < unique.length; i++) {
    let m = addMonths(unique[i - 1], 1);
    while (m < unique[i]) {
      gaps.push(m);
      m = addMonths(m, 1);
    }
  }
  const frequency = gaps.length === 0 && duplicates === 0 ? "MS" : "irregular";

  // Year-on-year % change against the same month one year earlier (pandas pct_change(12) * 100)
  const byIndex = new Map<number, number>();
  for (const p of points) if (p.value !== null && Number.isFinite(p.value)) byIndex.set(toIndex(p.month), p.value);
  const yoy: { month: string; yoyPct: number }[] = [];
  for (const p of points) {
    if (p.value === null || !Number.isFinite(p.value)) continue;
    const prev = byIndex.get(toIndex(p.month) - 12);
    if (prev === undefined || prev === 0) continue;
    yoy.push({ month: p.month, yoyPct: (p.value / prev - 1) * 100 });
  }
  const largestYoyMoves = [...yoy]
    .sort((a, b) => Math.abs(b.yoyPct) - Math.abs(a.yoyPct))
    .slice(0, topN)
    .map((y) => ({ month: y.month, absYoyPct: round1(Math.abs(y.yoyPct)), yoyPct: round1(y.yoyPct) }));

  const vals = points.map((p) => p.value).filter((v): v is number => v !== null && Number.isFinite(v));
  return {
    rows: points.length,
    from: sorted[0],
    to: sorted[sorted.length - 1],
    missing,
    duplicates,
    frequency,
    gaps,
    largestYoyMoves,
    min: Math.min(...vals),
    max: Math.max(...vals),
    mean: vals.reduce((a, b) => a + b, 0) / vals.length,
  };
}
