"use client";

import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import * as React from "react";
import { Loader2, Play, TriangleAlert } from "lucide-react";
import { ChartCard } from "@/components/charts/chart-card";
import { TimeSeriesChart, type ChartRow } from "@/components/charts/time-series-chart";
import { ProvenanceBadge } from "@/components/common/provenance-badge";
import { SimpleTable } from "@/components/common/simple-table";
import { useUpload } from "@/components/data/upload-context";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { formatMonth } from "@/lib/forecasting/dates";
import { runEngine, type EngineResult } from "@/lib/forecasting/evaluate";
import { MODEL_IDS, MODELS, type ModelId } from "@/lib/forecasting/models";
import { ENGINE_STYLE_NAME } from "@/lib/series-style";

const DEFAULT_MODELS: ModelId[] = ["naive", "seasonal-naive", "holt-winters-mul", "ridge-lags", "si-transfer"];
const fmt = (v: number | null | undefined, d = 2) => (v === null || v === undefined ? "n/a" : v.toFixed(d));

export interface ReferenceBundle {
  heroRows: ChartRow[];
  future: { month: string; values: Record<string, number>; pi80: [number, number]; pi95: [number, number] }[];
  holdout: { model: string; mape: number; wape: number; rmse: number; bias_pct: number }[];
  backtest: { model: string; mape: number; wape: number; rmse: number; bias_pct: number }[];
  bestModel: string;
  models: string[];
}

export function ForecastLab({
  reference,
  categoryIndex,
  refBundle: ref,
}: {
  reference: { months: string[]; values: number[] };
  categoryIndex: number[];
  refBundle: ReferenceBundle;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const { upload, ready } = useUpload();

  const tab = params.get("tab") === "reference" ? "reference" : "engine";
  const dataset = params.get("dataset") === "uploaded" ? "uploaded" : "reference";
  const horizon = [3, 6, 12].includes(Number(params.get("horizon"))) ? Number(params.get("horizon")) : 12;
  const origins = [6, 12, 18].includes(Number(params.get("origins"))) ? Number(params.get("origins")) : 12;
  const models = React.useMemo<ModelId[]>(() => {
    const raw = params.get("models");
    if (!raw) return DEFAULT_MODELS;
    const ids = raw.split(",").filter((m): m is ModelId => (MODEL_IDS as string[]).includes(m));
    return ids.length ? ids : DEFAULT_MODELS;
  }, [params]);

  const setParams = (patch: Record<string, string>) => {
    const next = new URLSearchParams(params.toString());
    for (const [k, v] of Object.entries(patch)) next.set(k, v);
    router.replace(`${pathname}?${next.toString()}`, { scroll: false });
  };

  const series = React.useMemo(
    () => (dataset === "uploaded" ? (upload ? { months: upload.months, values: upload.values } : null) : reference),
    [dataset, upload, reference],
  );
  const [result, setResult] = React.useState<EngineResult | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [pending, startTransition] = React.useTransition();
  const [selected, setSelected] = React.useState<ModelId | null>(null);

  const run = React.useCallback(() => {
    if (!series) return;
    startTransition(() => {
      try {
        const r = runEngine(series, { models, testHorizon: horizon, origins, categoryIndex });
        setResult(r);
        setError(null);
        setSelected((s) => (s && r.runs.some((x) => x.id === s && x.status === "evaluated") ? s : (r.best ?? null)));
      } catch (e) {
        setResult(null);
        setError((e as Error).message);
      }
    });
  }, [series, models, horizon, origins, categoryIndex]);

  // Auto-run when the inputs change (first load included).
  React.useEffect(() => {
    if (tab === "engine" && ready) run();
  }, [tab, ready, run]);

  const sel = result?.runs.find((r) => r.id === selected && r.status === "evaluated");
  const chartRows: ChartRow[] = React.useMemo(() => {
    if (!result || !series || !sel) return [];
    const n = series.values.length;
    const tail = Math.max(result.testHorizon + 24, 36);
    const start = Math.max(0, n - tail);
    const testStart = n - result.testHorizon;
    const rows: ChartRow[] = series.months.slice(start).map((m, i) => {
      const idx = start + i;
      const row: ChartRow = { month: m, Actual: series.values[idx] };
      if (idx >= testStart) row.test = Math.round(sel.holdout!.forecast[idx - testStart] * 10000) / 10000;
      return row;
    });
    sel.future!.months.forEach((m, i) => {
      const iv = sel.future!.intervals[i];
      rows.push({ month: m, future: sel.future!.forecast[i], pi80: [iv.low80, iv.high80], pi95: [iv.low95, iv.high95] });
    });
    return rows;
  }, [result, series, sel]);

  const styleName = selected ? ENGINE_STYLE_NAME[selected] : "Naïve";

  return (
    <Tabs value={tab} onValueChange={(v) => setParams({ tab: v })} className="space-y-6">
      <TabsList className="h-auto flex-wrap">
        <TabsTrigger value="engine">In-app engine results (TypeScript)</TabsTrigger>
        <TabsTrigger value="reference">Reference results (notebook, Python: SARIMA, Random Forest, XGBoost…)</TabsTrigger>
      </TabsList>

      <TabsContent value="engine" className="space-y-6">
        <div className="card-surface grid gap-5 p-4 md:p-5 lg:grid-cols-[1fr_1.4fr_auto]">
          <fieldset className="space-y-2">
            <legend className="mb-1 text-xs font-medium text-muted-foreground">Dataset</legend>
            {(["reference", "uploaded"] as const).map((d) => (
              <label key={d} className="flex items-center gap-2 text-sm">
                <input
                  type="radio"
                  name="dataset"
                  value={d}
                  checked={dataset === d}
                  onChange={() => setParams({ dataset: d })}
                  className="accent-[var(--primary)]"
                  data-testid={`dataset-${d}`}
                />
                {d === "reference" ? "Reference: FRED IPN31211N (proxy)" : upload ? `Your upload: ${upload.label}` : "Your upload (none yet)"}
              </label>
            ))}
            <div className="grid grid-cols-2 gap-3 pt-2">
              <div className="space-y-1">
                <Label htmlFor="horizon" className="text-xs">
                  Test horizon
                </Label>
                <select id="horizon" value={horizon} onChange={(e) => setParams({ horizon: e.target.value })} className="h-9 w-full rounded-lg border border-input bg-card px-2 text-sm">
                  {[3, 6, 12].map((h) => (
                    <option key={h} value={h}>
                      {h} months
                    </option>
                  ))}
                </select>
              </div>
              <div className="space-y-1">
                <Label htmlFor="origins" className="text-xs">
                  Backtest origins
                </Label>
                <select id="origins" value={origins} onChange={(e) => setParams({ origins: e.target.value })} className="h-9 w-full rounded-lg border border-input bg-card px-2 text-sm">
                  {[6, 12, 18].map((h) => (
                    <option key={h} value={h}>
                      {h} origins
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </fieldset>
          <fieldset>
            <legend className="mb-2 text-xs font-medium text-muted-foreground">Models (in-app engine)</legend>
            <div className="grid gap-2 sm:grid-cols-2">
              {MODEL_IDS.map((id) => (
                <label key={id} className="flex items-start gap-2 text-sm">
                  <Checkbox
                    checked={models.includes(id)}
                    data-testid={`model-toggle-${id}`}
                    aria-label={MODELS[id].name}
                    onCheckedChange={(c) => {
                      const next = c ? [...models, id] : models.filter((m) => m !== id);
                      if (next.length) setParams({ models: MODEL_IDS.filter((m) => next.includes(m)).join(",") });
                    }}
                  />
                  <span className="leading-tight">
                    {MODELS[id].name}
                    <span className="block text-[11px] text-muted-foreground">{MODELS[id].family}</span>
                  </span>
                </label>
              ))}
            </div>
          </fieldset>
          <div className="flex items-end">
            <Button onClick={run} disabled={pending || !series} data-testid="run-forecast" className="w-full lg:w-auto">
              {pending ? <Loader2 className="animate-spin" /> : <Play />} Run forecast
            </Button>
          </div>
        </div>

        {dataset === "uploaded" && !upload && ready && (
          <div className="card-surface p-6 text-center text-sm">
            <p className="font-medium">No upload in this browser session yet.</p>
            <p className="mt-1 text-muted-foreground">
              Upload a monthly CSV on the{" "}
              <Link href="/data#upload" className="text-primary underline">
                Data page
              </Link>{" "}
              or switch back to the reference dataset.
            </p>
          </div>
        )}
        {error && (
          <p role="alert" className="rounded-lg border border-critical/40 bg-critical/10 px-3 py-2 text-sm text-critical-fg">
            {error}
          </p>
        )}

        {result && (
          <div className="space-y-6" aria-busy={pending}>
            <div className="flex flex-wrap items-center gap-2 text-sm">
              <ProvenanceBadge kind="engine" />
              {dataset === "uploaded" ? <ProvenanceBadge kind="uploaded" /> : <ProvenanceBadge kind="proxy" />}
              <span className="text-muted-foreground">
                {result.n} months ({formatMonth(result.first)} – {formatMonth(result.last)}) · train {formatMonth(result.split.train.from)} –{" "}
                {formatMonth(result.split.train.to)} · test {formatMonth(result.split.test.from)} – {formatMonth(result.split.test.to)} · {result.origins} origins ×
                3 months
              </span>
            </div>
            {result.warnings.map((w) => (
              <p key={w} className="flex items-start gap-2 rounded-lg border border-warning/40 bg-warning/10 px-3 py-2 text-sm text-warning-fg">
                <TriangleAlert className="mt-0.5 size-4 shrink-0" aria-hidden /> {w}
              </p>
            ))}

            <SimpleTable
              testId="engine-results"
              caption="In-app engine evaluation"
              rows={result.runs}
              highlight={(r) => r.id === selected}
              columns={[
                {
                  key: "m",
                  header: "Model",
                  cell: (r) =>
                    r.status === "evaluated" ? (
                      <button type="button" className="text-left font-medium text-primary hover:underline" onClick={() => setSelected(r.id)}>
                        {r.name}
                        {r.id === result.best && <span className="ml-2 rounded bg-primary/10 px-1.5 text-[10px] font-semibold text-teal-fg">BEST</span>}
                      </button>
                    ) : (
                      r.name
                    ),
                },
                { key: "hm", header: "Hold-out MAPE %", numeric: true, cell: (r) => fmt(r.holdout?.metrics.mape) },
                { key: "hw", header: "Hold-out WAPE %", numeric: true, cell: (r) => fmt(r.holdout?.metrics.wape) },
                { key: "bm", header: "Backtest MAPE %", numeric: true, cell: (r) => fmt(r.backtest?.metrics.mape) },
                { key: "bw", header: "Backtest WAPE %", numeric: true, cell: (r) => fmt(r.backtest?.metrics.wape) },
                { key: "rm", header: "RMSE", numeric: true, cell: (r) => fmt(r.holdout?.metrics.rmse) },
                { key: "bi", header: "Bias %", numeric: true, cell: (r) => fmt(r.holdout?.metrics.biasPct) },
                { key: "ex", header: "Zero actuals excl.", numeric: true, cell: (r) => (r.holdout ? r.holdout.metrics.mapeExcluded : "") },
                { key: "st", header: "Status", cell: (r) => (r.status === "evaluated" ? "Evaluated" : <span className="text-muted-foreground">Not run: {r.reason}</span>) },
              ]}
            />

            {sel && (
              <>
                <ChartCard
                  testId="chart-engine"
                  title={`${sel.name}: hold-out test and the next 3 months`}
                  description={`${dataset === "uploaded" ? "Your units" : "Index (2017 = 100)"}. Bands: empirical 80% / 95% intervals from the model's backtest errors.`}
                  badges={<ProvenanceBadge kind="engine" />}
                  data={chartRows.map((r) => ({
                    month: r.month as string,
                    actual: (r.Actual as number) ?? null,
                    holdout_forecast: (r.test as number) ?? null,
                    future_forecast: (r.future as number) ?? null,
                  }))}
                  fileName={`engine-${sel.id}`}
                >
                  <TimeSeriesChart
                    data={chartRows}
                    yLabel={dataset === "uploaded" ? "Value" : "Index (2017 = 100)"}
                    height={320}
                    dividers={[
                      { x: result.split.test.from, label: "test" },
                      { x: result.futureMonths[0], label: "forecast" },
                    ]}
                    bands={[
                      { key: "pi95", name: "95% interval", color: "var(--band)", opacity: 0.08 },
                      { key: "pi80", name: "80% interval", color: "var(--band)", opacity: 0.18 },
                    ]}
                    series={[
                      { key: "Actual", name: "Actual", dots: true },
                      { key: "test", name: `${sel.name} (hold-out)`, style: styleName },
                      { key: "future", name: `${sel.name} (next 3 months)`, style: styleName, dots: true, emphasize: true },
                    ]}
                  />
                </ChartCard>
                <SimpleTable
                  testId="forecast-table"
                  caption="Next 3 months forecast"
                  rows={sel.future!.months.map((m, i) => ({ m, f: sel.future!.forecast[i], iv: sel.future!.intervals[i] }))}
                  columns={[
                    { key: "m", header: "Month", cell: (r) => formatMonth(r.m) },
                    { key: "f", header: "Forecast", numeric: true, cell: (r) => r.f.toFixed(2) },
                    { key: "l8", header: "Low (80%)", numeric: true, cell: (r) => r.iv.low80.toFixed(2) },
                    { key: "h8", header: "High (80%)", numeric: true, cell: (r) => r.iv.high80.toFixed(2) },
                    { key: "l9", header: "Low (95%)", numeric: true, cell: (r) => r.iv.low95.toFixed(2) },
                    { key: "h9", header: "High (95%)", numeric: true, cell: (r) => r.iv.high95.toFixed(2) },
                    { key: "mo", header: "Model", cell: () => sel.name },
                  ]}
                />
                <p className="text-xs text-muted-foreground">
                  Interval method: {sel.future!.intervals[0].method}. Future months are derived from the last observation ({formatMonth(result.last)}) and the
                  model is refitted on all data before forecasting. These in-app results are separate from the notebook&apos;s reference results.
                </p>
              </>
            )}
          </div>
        )}
      </TabsContent>

      <TabsContent value="reference" className="space-y-6">
        <div className="flex flex-wrap gap-2">
          <ProvenanceBadge kind="reference" />
          <ProvenanceBadge kind="proxy" />
        </div>
        <ChartCard
          testId="chart-reference"
          title="Notebook forecast for the next 3 months"
          description="Index (2017 = 100). Last 36 months, XGBoost's hold-out forecast and every model's next-3-month forecast; SARIMA 80/95% intervals."
          data={ref.future.map((f) => ({ month: f.month, ...f.values, sarima_pi95_low: f.pi95[0], sarima_pi95_high: f.pi95[1] }))}
          fileName="reference-forecast"
        >
          <TimeSeriesChart
            data={ref.heroRows}
            yLabel="Index (2017 = 100)"
            height={320}
            dividers={[{ x: ref.future[0].month, label: "forecast" }]}
            bands={[
              { key: "pi95", name: "SARIMA 95%", color: "var(--m-sarima)", opacity: 0.08 },
              { key: "pi80", name: "SARIMA 80%", color: "var(--m-sarima)", opacity: 0.16 },
            ]}
            series={[
              { key: "Actual", name: "Actual", dots: true },
              ...ref.models.map((m) => ({
                key: `${m}__future`,
                name: m,
                style: m,
                dots: true,
                emphasize: m === ref.bestModel,
                defaultHidden: !["XGBoost", "SARIMA", "Holt-Winters", "Naïve"].includes(m),
              })),
            ]}
          />
        </ChartCard>
        <SimpleTable
          testId="reference-forecast-table"
          caption="Reference forecasts, next 3 months"
          rows={ref.future}
          columns={[
            { key: "m", header: "Month", cell: (r) => formatMonth(r.month) },
            ...ref.models.map((m) => ({
              key: m,
              header: m === ref.bestModel ? `${m} (selected)` : m,
              numeric: true,
              cell: (r: ReferenceBundle["future"][number]) => r.values[m].toFixed(2),
            })),
            { key: "p8", header: "SARIMA 80%", numeric: true, cell: (r) => `${r.pi80[0].toFixed(2)} – ${r.pi80[1].toFixed(2)}` },
            { key: "p9", header: "SARIMA 95%", numeric: true, cell: (r) => `${r.pi95[0].toFixed(2)} – ${r.pi95[1].toFixed(2)}` },
          ]}
        />
        <div className="grid gap-4 xl:grid-cols-2">
          {[
            { title: "Hold-out (12 months, Oct 2025 – Sep 2026)", rows: ref.holdout },
            { title: "Rolling 3-month backtest (54 forecasts)", rows: ref.backtest },
          ].map((t) => (
            <div key={t.title} className="space-y-2">
              <h3 className="text-sm font-semibold">{t.title}</h3>
              <SimpleTable
                caption={t.title}
                rows={t.rows}
                highlight={(r) => r.model === ref.bestModel}
                dense
                columns={[
                  { key: "m", header: "Model", cell: (r) => r.model },
                  { key: "a", header: "MAPE %", numeric: true, cell: (r) => r.mape.toFixed(2) },
                  { key: "w", header: "WAPE %", numeric: true, cell: (r) => r.wape.toFixed(2) },
                  { key: "r", header: "RMSE", numeric: true, cell: (r) => r.rmse.toFixed(2) },
                  { key: "b", header: "Bias %", numeric: true, cell: (r) => r.bias_pct.toFixed(2) },
                ]}
              />
            </div>
          ))}
        </div>
      </TabsContent>
    </Tabs>
  );
}
