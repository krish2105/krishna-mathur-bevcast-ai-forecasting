/**
 * Chart-ready views of the reference export. Every value is copied from data/*.json (notebook export);
 * nothing here invents numbers. Derived values (YoY growth, residuals, ranges) are simple arithmetic on
 * those exported values and are labelled as derived where shown.
 */
import "server-only";
import { addMonths, toIndex } from "@/lib/forecasting/dates";
import { REFERENCE_MODELS, part2, series } from "@/lib/data/reference";

export type Row = Record<string, string | number | null | [number, number]>;

const r4 = (v: number) => Math.round(v * 10000) / 10000;

/** Last `months` of actuals + test-year forecasts of `testModels` + the 3-month future with SARIMA bands. */
export function forecastHeroRows(months = 36, futureModels: string[] = [...REFERENCE_MODELS], testModels: string[] = ["XGBoost"]) {
  const actual = series.fred_monthly.slice(-months);
  const testByMonth = new Map(series.test_forecasts.map((r) => [r.month, r]));
  const rows: Row[] = actual.map((p) => {
    const row: Row = { month: p.month, Actual: p.value };
    const t = testByMonth.get(p.month);
    if (t) for (const m of testModels) row[`${m}__test`] = r4(t[m] as number);
    return row;
  });
  for (const f of part2.future.rows) {
    const row: Row = { month: f.month };
    for (const m of futureModels) row[`${m}__future`] = r4(f[m] as number);
    row.pi95 = [r4(f.sarima_pi95[0]), r4(f.sarima_pi95[1])];
    row.pi80 = [r4(f.sarima_pi80[0]), r4(f.sarima_pi80[1])];
    rows.push(row);
  }
  return rows;
}

/** Test year: actual + every reference model's 12-month forecast from the Sep 2025 origin. */
export function testRows(withTrainTail = 24): Row[] {
  const trainTail = series.fred_monthly.filter((p) => p.month <= part2.split.train.to).slice(-withTrainTail);
  const rows: Row[] = trainTail.map((p) => ({ month: p.month, Train: p.value }));
  for (const t of series.test_forecasts) {
    const row: Row = { month: t.month, Actual: t.actual };
    for (const m of REFERENCE_MODELS) row[m] = r4(t[m] as number);
    rows.push(row);
  }
  return rows;
}

export function residualRows(model: string): Row[] {
  return series.test_forecasts.map((t) => ({
    month: t.month,
    residual: r4(t.actual - (t[model] as number)),
  }));
}

/** Year x month matrix of the FRED index (2012–2026). */
export function heatmapRows() {
  const byYear = new Map<number, (number | null)[]>();
  for (const p of series.fred_monthly) {
    const idx = toIndex(p.month);
    const y = Math.floor(idx / 12);
    if (!byYear.has(y)) byYear.set(y, Array(12).fill(null));
    byYear.get(y)![idx % 12] = p.value;
  }
  return [...byYear.entries()].map(([year, values]) => ({ year, values }));
}

/** Calendar-year averages and year-on-year growth of the annual average (derived). */
export function annualRows() {
  const out: { year: number; mean: number; months: number; yoy: number | null }[] = [];
  for (const { year, values } of heatmapRows()) {
    const v = values.filter((x): x is number => x !== null);
    const mean = v.reduce((a, b) => a + b, 0) / v.length;
    const prev = out.at(-1);
    out.push({ year, mean: r4(mean), months: v.length, yoy: prev && v.length === 12 && prev.months === 12 ? r4((mean / prev.mean - 1) * 100) : null });
  }
  return out;
}

/** Month-on-same-month-last-year growth for the last 36 months (derived from the FRED values). */
export function yoyRows(months = 36): Row[] {
  const map = new Map(series.fred_monthly.map((p) => [p.month, p.value]));
  return series.fred_monthly.slice(-months).map((p) => {
    const prev = map.get(addMonths(p.month, -12));
    return { month: p.month, yoy: prev ? r4((p.value / prev - 1) * 100) : null };
  });
}

export function historyRows(): Row[] {
  const trend = new Map(series.trend_12m_centred.map((p) => [p.month, p.value]));
  return series.fred_monthly.map((p) => ({ month: p.month, Actual: p.value, Trend: trend.get(p.month) ?? null }));
}

export function stlRows(): Row[] {
  return series.stl.map((s) => ({ month: s.month, Trend: s.trend, Seasonal: s.seasonal, Remainder: s.remainder }));
}

/** 3-month-ahead backtest: error per origin for each model (pooled view for the residual chart). */
export function backtestErrorRows(): Row[] {
  return series.backtest_detail.map((r) => {
    const row: Row = { origin: r.origin, target: r.target, h: r.h, actual: r.actual };
    for (const m of REFERENCE_MODELS) row[m] = r4((r[m] as number) - r.actual);
    return row;
  });
}

export function firstYearRows(): Row[] {
  const rows: Row[] = series.first_year.history.map((p) => ({ month: p.month, "First year (training)": p.value }));
  for (const f of series.first_year.forecasts) {
    const row: Row = { month: f.month, Actual: f.actual };
    for (const [k, v] of Object.entries(f)) if (k !== "month" && k !== "actual") row[k] = r4(v as number);
    rows.push(row);
  }
  return rows;
}
