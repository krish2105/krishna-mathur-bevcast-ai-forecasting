/**
 * Validation design (same as the notebook):
 *  - chronological hold-out: the last `testHorizon` months are hidden; each model is fitted on the months
 *    before them and forecasts the whole block from that single origin (multi-step);
 *  - rolling-origin backtest: for k = origins..1 the model is refitted on data up to origin
 *    n - H - (k - 1) and forecasts the next H months; errors are pooled over origins x H forecasts;
 *  - future: refit on ALL history and forecast exactly `FUTURE_HORIZON` months after the last observation.
 * No step ever lets a model see a value at or after the month it forecasts.
 */
import { scoreAll, type MetricSet } from "@/lib/metrics";
import { nextMonths } from "./dates";
import { MODELS, type ModelContext, type ModelId } from "./models";

export const FUTURE_HORIZON = 3;
export const BACKTEST_HORIZON = 3;

export interface SeriesInput {
  months: string[];
  values: number[];
}

export interface Split {
  train: SeriesInput;
  test: SeriesInput;
}

export function chronologicalSplit(series: SeriesInput, testHorizon: number): Split {
  const n = series.values.length;
  if (testHorizon < 1 || testHorizon >= n) throw new Error(`Test horizon must be between 1 and ${n - 1}`);
  const cut = n - testHorizon;
  return {
    train: { months: series.months.slice(0, cut), values: series.values.slice(0, cut) },
    test: { months: series.months.slice(cut), values: series.values.slice(cut) },
  };
}

export interface ModelAvailability {
  id: ModelId;
  available: boolean;
  reason?: string;
}

/** Which models can be fitted on a training window of length `trainLength` given the full length `n`. */
export function availability(id: ModelId, trainLength: number, n: number, hasCategoryIndex: boolean): ModelAvailability {
  const spec = MODELS[id];
  if (spec.seasonal2Cycles && n <= 24) {
    return { id, available: false, reason: "Needs two or more full seasonal cycles; 24 months or fewer uploaded" };
  }
  if (id === "si-transfer" && !hasCategoryIndex) return { id, available: false, reason: "No category seasonal index" };
  const need = spec.minHistory({ n: trainLength });
  if (trainLength < need) {
    return { id, available: false, reason: `Needs at least ${need} training months (has ${trainLength})` };
  }
  return { id, available: true };
}

function ctxFor(months: readonly string[], categoryIndex?: readonly number[]): ModelContext {
  return { months, categoryIndex };
}

export interface BacktestPoint {
  origin: string;
  target: string;
  h: number;
  actual: number;
  forecast: number;
}

export function rollingOriginBacktest(
  series: SeriesInput,
  id: ModelId,
  origins: number,
  horizon = BACKTEST_HORIZON,
  categoryIndex?: readonly number[],
): BacktestPoint[] {
  const n = series.values.length;
  const out: BacktestPoint[] = [];
  for (let k = origins; k >= 1; k--) {
    const end = n - horizon - (k - 1);
    if (end < 1) continue;
    const histV = series.values.slice(0, end);
    const histM = series.months.slice(0, end);
    const fc = MODELS[id].forecast(histV, horizon, ctxFor(histM, categoryIndex));
    for (let h = 0; h < horizon; h++) {
      out.push({
        origin: histM[histM.length - 1],
        target: series.months[end + h],
        h: h + 1,
        actual: series.values[end + h],
        forecast: fc[h],
      });
    }
  }
  return out;
}

/** Linear-interpolated quantile of a sorted copy. */
export function quantile(values: readonly number[], q: number): number {
  if (values.length === 0) throw new Error("quantile of empty array");
  const s = [...values].sort((a, b) => a - b);
  const pos = (s.length - 1) * q;
  const lo = Math.floor(pos);
  const hi = Math.ceil(pos);
  return s[lo] + (s[hi] - s[lo]) * (pos - lo);
}

export interface Interval {
  low80: number;
  high80: number;
  low95: number;
  high95: number;
  method: string;
}

/**
 * Empirical prediction intervals: forecast + quantiles of the backtest errors (actual - forecast) at the
 * same step h. With fewer than 5 errors at a step, the pooled errors are scaled by sqrt(h). If every error is
 * identical the band would collapse, so its half-width falls back to 1.28 / 1.96 x RMSE.
 */
export function empiricalIntervals(forecast: readonly number[], bt: readonly BacktestPoint[]): Interval[] {
  const pooled = bt.map((p) => p.actual - p.forecast);
  const rms = Math.sqrt(pooled.reduce((a, e) => a + e * e, 0) / Math.max(pooled.length, 1)) || Math.abs(forecast[0]) * 0.01 || 1;
  return forecast.map((f, i) => {
    const h = i + 1;
    let errs = bt.filter((p) => p.h === h).map((p) => p.actual - p.forecast);
    let method = `empirical quantiles of ${errs.length} backtest errors at step ${h}`;
    if (errs.length < 5) {
      errs = pooled.map((e) => e * Math.sqrt(h));
      method = `pooled backtest errors (${pooled.length}) scaled by √h`;
    }
    let low80 = f + quantile(errs, 0.1);
    let high80 = f + quantile(errs, 0.9);
    let low95 = f + quantile(errs, 0.025);
    let high95 = f + quantile(errs, 0.975);
    if (!(high80 - low80 > 1e-9) || !(high95 - low95 > 1e-9)) {
      const s = rms * Math.sqrt(h);
      [low80, high80, low95, high95] = [f - 1.2816 * s, f + 1.2816 * s, f - 1.96 * s, f + 1.96 * s];
      method = "normal approximation from backtest RMSE (errors had no spread)";
    }
    return { low80, high80, low95: Math.min(low95, low80), high95: Math.max(high95, high80), method };
  });
}

export interface ModelRun {
  id: ModelId;
  name: string;
  status: "evaluated" | "not-run";
  reason?: string;
  holdout?: { forecast: number[]; metrics: MetricSet };
  backtest?: { points: BacktestPoint[]; metrics: MetricSet };
  future?: { months: string[]; forecast: number[]; intervals: Interval[] };
  error?: string;
}

export interface EngineResult {
  n: number;
  first: string;
  last: string;
  testHorizon: number;
  origins: number;
  split: { train: { from: string; to: string; n: number }; test: { from: string; to: string; n: number } };
  futureMonths: string[];
  runs: ModelRun[];
  warnings: string[];
  /** Best evaluated model by backtest WAPE, then hold-out WAPE. */
  best?: ModelId;
}

export interface EngineOptions {
  models: ModelId[];
  testHorizon: number;
  origins: number;
  categoryIndex?: readonly number[];
}

export function runEngine(series: SeriesInput, opts: EngineOptions): EngineResult {
  const n = series.values.length;
  if (series.months.length !== n) throw new Error("months and values differ in length");
  if (n < 6) throw new Error("At least 6 months of data are needed");
  const warnings: string[] = [];
  const testHorizon = Math.min(opts.testHorizon, Math.max(1, Math.floor(n / 3)));
  if (testHorizon !== opts.testHorizon) warnings.push(`Test horizon reduced to ${testHorizon} months for a ${n}-month series.`);
  if (n <= 24) {
    warnings.push(
      `Only ${n} months of data: seasonality cannot be estimated reliably from fewer than two full years. ` +
        "Seasonal models that need two cycles are disabled. Consider the category seasonal-index transfer method.",
    );
  }
  const split = chronologicalSplit(series, testHorizon);
  const maxOrigins = Math.max(0, n - BACKTEST_HORIZON - 1);
  const origins = Math.min(opts.origins, maxOrigins);
  if (origins !== opts.origins) warnings.push(`Backtest origins reduced to ${origins}.`);
  const futureMonths = nextMonths(series.months[n - 1], FUTURE_HORIZON);

  const runs: ModelRun[] = opts.models.map((id) => {
    const spec = MODELS[id];
    // the earliest backtest origin has the shortest history, so it decides whether a model can run
    const shortestTrain = Math.min(split.train.values.length, n - BACKTEST_HORIZON - (origins - 1));
    const av = availability(id, shortestTrain, n, !!opts.categoryIndex);
    if (!av.available) return { id, name: spec.name, status: "not-run", reason: av.reason };
    try {
      const hf = spec.forecast(split.train.values, testHorizon, ctxFor(split.train.months, opts.categoryIndex));
      const points = rollingOriginBacktest(series, id, origins, BACKTEST_HORIZON, opts.categoryIndex);
      const fut = spec.forecast(series.values, FUTURE_HORIZON, ctxFor(series.months, opts.categoryIndex));
      return {
        id,
        name: spec.name,
        status: "evaluated",
        holdout: { forecast: hf, metrics: scoreAll(split.test.values, hf) },
        backtest: {
          points,
          metrics: scoreAll(points.map((p) => p.actual), points.map((p) => p.forecast)),
        },
        future: { months: futureMonths, forecast: fut, intervals: empiricalIntervals(fut, points) },
      };
    } catch (e) {
      return { id, name: spec.name, status: "not-run", reason: (e as Error).message, error: (e as Error).message };
    }
  });

  const evaluated = runs.filter((r) => r.status === "evaluated");
  const key = (r: ModelRun) => [r.backtest?.metrics.wape ?? Infinity, r.holdout?.metrics.wape ?? Infinity];
  const best = [...evaluated].sort((a, b) => {
    const [a1, a2] = key(a);
    const [b1, b2] = key(b);
    return a1 - b1 || a2 - b2;
  })[0]?.id;

  return {
    n,
    first: series.months[0],
    last: series.months[n - 1],
    testHorizon,
    origins,
    split: {
      train: { from: split.train.months[0], to: split.train.months.at(-1)!, n: split.train.values.length },
      test: { from: split.test.months[0], to: split.test.months.at(-1)!, n: split.test.values.length },
    },
    futureMonths,
    runs,
    warnings,
    best,
  };
}
