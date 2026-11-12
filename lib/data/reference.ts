/**
 * Reference results exported from the executed notebook (scripts/export_results.py).
 * Validated with Zod when first imported, so a malformed export fails the build instead of rendering
 * wrong numbers. Server-only: pages pass slices of this data to client components as props.
 */
import "server-only";
import { z } from "zod";
import metaJson from "@/data/meta.json";
import part1Json from "@/data/part1.json";
import part2Json from "@/data/part2.json";
import seriesJson from "@/data/series.json";

const num = z.number().finite();
const month = z.string().regex(/^\d{4}-\d{2}$/);
const score = z.object({ model: z.string(), mape: num, wape: num, rmse: num, bias_pct: num });

const Part1 = z.object({
  title: z.string(),
  monthly: z.array(z.object({ month, demand: num, temp_mean_c: num, temp_max_c: num })).length(12),
  correlation: num,
  slope_units_per_c: num,
  intercept: num,
  demand_stats: z.object({ mean: num, std: num, min: num, max: num }),
  temp_stats: z.object({ mean: num, std: num, min: num, max: num }),
  naive: z.object({
    window: z.string(),
    mape: num,
    wape: num,
    sum_abs_error: num,
    sum_demand: num,
    rows: z.array(z.object({ month, demand: num, forecast: num, abs_error: num, abs_pct_error: num })),
  }),
  in_sample: z.object({
    window: z.string(),
    warning: z.string(),
    scores: z.array(z.object({ model: z.string(), mape: num, wape: num })),
    rows: z.array(z.object({ month, demand: num, naive: num, rf_in_sample: num })),
  }),
  walk_forward: z.object({
    window: z.string(),
    design: z.string(),
    models: z.array(z.string()),
    rows: z.array(z.record(z.string(), z.union([z.string(), num]))),
    scores: z.array(z.object({ model: z.string(), mape: num, wape: num, wape_change_vs_naive_pp: num })),
    weather_regression_full_year: z.object({ intercept: num, beta: num, formula: z.string() }),
  }),
  impact: z.object({
    total_demand_jul_dec: num,
    rows: z.array(z.object({ model: z.string(), stockout_units: num, excess_units: num, total_units: num, share_pct: num })),
  }),
  notebook_sections: z.record(z.string(), z.string()),
});

const Part2 = z.object({
  title: z.string(),
  series: z.object({
    id: z.literal("IPN31211N"),
    name: z.string(),
    publisher: z.string(),
    url: z.string().url(),
    unit: z.string(),
    coverage: z.string(),
    proxy_note: z.string(),
    window: z.object({ from: month, to: month, n_months: num }),
    full_history: z.object({ from: month, to: month, rows: num }),
    notebook_retrieval: z.string(),
    stats: z.record(z.string(), num),
    quality: z.object({
      missing: num,
      duplicates: num,
      frequency: z.string(),
      largest_yoy_moves: z.array(z.object({ month, abs_yoy_pct: num })),
    }),
  }),
  decomposition: z.object({ method: z.string(), strength_seasonal: num, strength_trend: num }),
  seasonal_index: z.array(z.object({ month: z.string(), index: num })).length(12),
  features: z.object({
    list: z.array(z.string()),
    correlation_with_target: z.record(z.string(), num),
    supervised_shape: z.array(num),
  }),
  sarima: z.object({
    order: z.array(num),
    seasonal_order: z.array(num),
    label: z.string(),
    candidates: num,
    top5: z.array(z.object({ order: z.string(), seasonal_order: z.string(), aic: num })),
  }),
  split: z.object({
    train: z.object({ from: month, to: month, n: num }),
    test: z.object({ from: month, to: month, n: num }),
  }),
  models: z.array(z.string()).length(6),
  holdout: z.object({ label: z.string(), scores: z.array(score.extend({ wape_improvement_vs_naive_pct: num })) }),
  backtest: z.object({ label: z.string(), origins: num, horizon: num, n_forecasts: num, scores: z.array(score) }),
  best_model: z.string(),
  selection_rule: z.string(),
  future: z.object({
    last_actual: z.object({ month, value: num }),
    rows: z
      .array(
        z
          .object({ month, sarima_pi80: z.tuple([num, num]), sarima_pi95: z.tuple([num, num]) })
          .catchall(z.union([num, z.tuple([num, num]), z.string()])),
      )
      .length(3),
  }),
  shape: z.object({
    actual_amplitude_pct: num,
    actual_peak_month: z.string(),
    rows: z.array(z.object({ model: z.string(), amplitude_pct: num, shape_corr: num.nullable(), peak_month: z.string() })),
  }),
  first_year: z.object({
    label: z.string(),
    window: z.object({ from: month, to: month }),
    scores: z.array(score),
    category_seasonal_index: z.array(z.object({ month: z.string(), index: num })).length(12),
  }),
  feature_importance: z.object({
    note: z.string(),
    features: z.array(z.string()),
    random_forest: z.array(num),
    xgboost: z.array(num),
  }),
  notebook_llm: z.object({ label: z.string(), backend: z.string(), markdown: z.string() }),
  notebook_weather_snapshot: z.object({
    label: z.string(),
    note: z.string(),
    rows: z.array(z.record(z.string(), z.string())),
  }),
  notebook_sections: z.record(z.string(), z.string()),
});

const point = z.object({ month, value: num });
const Series = z.object({
  fred_monthly: z.array(point).length(177),
  fred_full_history: z.array(point),
  trend_12m_centred: z.array(z.object({ month, value: num.nullable() })),
  stl: z.array(z.object({ month, trend: num, seasonal: num, remainder: num })),
  test_forecasts: z.array(z.object({ month, actual: num }).catchall(num)).length(12),
  backtest_detail: z.array(z.object({ origin: month, target: month, h: num, actual: num }).catchall(num)).length(54),
  first_year: z.object({
    history: z.array(point).length(12),
    forecasts: z.array(z.object({ month, actual: num }).catchall(num)).length(12),
  }),
});

const Meta = z.object({
  app: z.string(),
  student: z.object({
    name: z.string(),
    roll: z.string(),
    programme: z.string(),
    batch: z.string(),
    institution: z.string(),
    subject: z.string(),
    assignment: z.string(),
  }),
  notebook: z.object({
    file: z.string(),
    notebook_sha256: z.string().length(64),
    fred_csv_sha256: z.string().length(64),
    temp_csv_sha256: z.string().length(64),
    executed_with: z.object({ part1: z.string(), part2: z.string() }),
    fred_retrieval: z.string(),
  }),
  export: z.object({ generated_at: z.string(), assertions_passed: num }).passthrough(),
  labels: z.record(z.string(), z.string()),
  sources: z.array(
    z.object({ id: z.string(), name: z.string(), label: z.string(), url: z.string().nullable(), retrieved: z.string().nullable() }),
  ),
  colab_url: z.string().url(),
});

export const part1 = Part1.parse(part1Json);
export const part2 = Part2.parse(part2Json);
export const series = Series.parse(seriesJson);
export const meta = Meta.parse(metaJson);

export type Part1 = z.infer<typeof Part1>;
export type Part2 = z.infer<typeof Part2>;
export type ReferenceSeries = z.infer<typeof Series>;
export type Meta = z.infer<typeof Meta>;

export const REFERENCE_MODELS = ["Naïve", "Seasonal Naïve", "SARIMA", "Holt-Winters", "Random Forest", "XGBoost"] as const;
export type ReferenceModel = (typeof REFERENCE_MODELS)[number];

/** Convenience lookups used across pages. */
export function holdoutScore(model: string) {
  return part2.holdout.scores.find((s) => s.model === model)!;
}
export function backtestScore(model: string) {
  return part2.backtest.scores.find((s) => s.model === model)!;
}
export const bestModel = part2.best_model as ReferenceModel;
export const fredValues = series.fred_monthly.map((p) => p.value);
export const fredMonths = series.fred_monthly.map((p) => p.month);
export const categoryIndex = part2.seasonal_index.map((s) => s.index);
