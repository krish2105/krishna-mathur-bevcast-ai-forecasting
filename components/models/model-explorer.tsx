"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import * as React from "react";
import { ArrowDown, ArrowUp, ArrowUpDown } from "lucide-react";
import { ModelBars, SignedColumns } from "@/components/charts/bar-charts";
import { ChartCard } from "@/components/charts/chart-card";
import { LineSwatch } from "@/components/charts/series-legend";
import { TimeSeriesChart, type ChartRow } from "@/components/charts/time-series-chart";
import { InfoTip } from "@/components/common/info-tip";
import { ProvenanceBadge } from "@/components/common/provenance-badge";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";

export interface Score {
  model: string;
  mape: number;
  wape: number;
  rmse: number;
  bias_pct: number;
}

type Eval = "holdout" | "backtest";
type SortKey = "wape" | "mape" | "rmse" | "bias_pct" | "model";

export function ModelExplorer({
  holdout,
  backtest,
  naiveHoldoutWape,
  naiveBacktestWape,
  bestModel,
  testRows,
  residuals,
  testFrom,
}: {
  holdout: Score[];
  backtest: Score[];
  naiveHoldoutWape: number;
  naiveBacktestWape: number;
  bestModel: string;
  testRows: ChartRow[];
  residuals: Record<string, { month: string; residual: number }[]>;
  testFrom: string;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const evaluation: Eval = params.get("evaluation") === "backtest" ? "backtest" : "holdout";
  const modelParam = params.get("model");
  const selected = modelParam && holdout.some((h) => h.model === modelParam) ? modelParam : bestModel;
  const [sort, setSort] = React.useState<{ key: SortKey; dir: 1 | -1 }>({ key: "wape", dir: 1 });

  const setParam = (k: string, v: string) => {
    const next = new URLSearchParams(params.toString());
    next.set(k, v);
    router.replace(`${pathname}?${next.toString()}`, { scroll: false });
  };

  const scores = evaluation === "holdout" ? holdout : backtest;
  const naiveW = evaluation === "holdout" ? naiveHoldoutWape : naiveBacktestWape;
  const ranked = [...scores].sort((a, b) => a.wape - b.wape).map((s, i) => ({ ...s, rank: i + 1 }));
  const rows = [...ranked].sort((a, b) => {
    const av = a[sort.key];
    const bv = b[sort.key];
    return (typeof av === "string" ? av.localeCompare(bv as string) : (av as number) - (bv as number)) * sort.dir;
  });

  const header = (key: SortKey, label: string, numeric = true) => {
    const active = sort.key === key;
    const Icon = !active ? ArrowUpDown : sort.dir === 1 ? ArrowUp : ArrowDown;
    return (
      <th
        scope="col"
        aria-sort={active ? (sort.dir === 1 ? "ascending" : "descending") : "none"}
        className={cn("border-b border-border px-3 py-2 text-xs font-medium whitespace-nowrap text-muted-foreground", numeric ? "text-right" : "text-left")}
      >
        <button
          type="button"
          className="inline-flex items-center gap-1 hover:text-foreground"
          onClick={() => setSort((s) => ({ key, dir: s.key === key ? ((-s.dir) as 1 | -1) : 1 }))}
        >
          {label} <Icon className="size-3" aria-hidden />
        </button>
      </th>
    );
  };

  const defaultHidden = new Set(["Random Forest", "Seasonal Naïve"]);

  return (
    <div className="space-y-8">
      <div className="space-y-4" id="leaderboard">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <Tabs value={evaluation} onValueChange={(v) => setParam("evaluation", v)}>
            <TabsList>
              <TabsTrigger value="holdout">Hold-out (12 months)</TabsTrigger>
              <TabsTrigger value="backtest">3-month backtest (54 forecasts)</TabsTrigger>
            </TabsList>
          </Tabs>
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <ProvenanceBadge kind="reference" />
            <InfoTip term={evaluation === "holdout" ? "holdout" : "backtest"} />
          </div>
        </div>
        <div className="overflow-x-auto rounded-lg border border-border" data-testid="leaderboard" role="region" aria-label="Model leaderboard" tabIndex={0}>
          <table className="w-full min-w-[720px] border-collapse text-sm">
            <caption className="sr-only">Model leaderboard, {evaluation === "holdout" ? "12-month hold-out" : "3-month rolling backtest"}</caption>
            <thead className="bg-muted">
              <tr>
                <th scope="col" className="border-b border-border px-3 py-2 text-right text-xs font-medium text-muted-foreground">
                  Rank
                </th>
                {header("model", "Model", false)}
                {header("mape", "MAPE %")}
                {header("wape", "WAPE %")}
                {header("rmse", "RMSE")}
                {header("bias_pct", "Bias %")}
                <th scope="col" className="border-b border-border px-3 py-2 text-right text-xs font-medium text-muted-foreground">
                  WAPE vs Naïve
                </th>
                <th scope="col" className="border-b border-border px-3 py-2 text-left text-xs font-medium text-muted-foreground">
                  Status
                </th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => {
                const imp = (1 - r.wape / naiveW) * 100;
                return (
                  <tr
                    key={r.model}
                    className={cn("cursor-pointer border-b border-border last:border-0 hover:bg-muted/60", r.model === selected && "bg-accent/70 font-medium")}
                    onClick={() => setParam("model", r.model)}
                    aria-selected={r.model === selected}
                  >
                    <td className="px-3 py-2 text-right tabular-nums">{r.rank}</td>
                    <td className="px-3 py-2">
                      <button type="button" className="flex items-center gap-2 text-left" onClick={() => setParam("model", r.model)}>
                        <LineSwatch name={r.model} />
                        {r.model}
                        {r.model === bestModel && <span className="rounded bg-primary/10 px-1.5 text-[10px] font-semibold text-teal-fg">SELECTED</span>}
                      </button>
                    </td>
                    <td className="px-3 py-2 text-right tabular-nums">{r.mape.toFixed(2)}</td>
                    <td className="px-3 py-2 text-right tabular-nums">{r.wape.toFixed(2)}</td>
                    <td className="px-3 py-2 text-right tabular-nums">{r.rmse.toFixed(2)}</td>
                    <td className="px-3 py-2 text-right tabular-nums">
                      {r.bias_pct > 0 ? "+" : ""}
                      {r.bias_pct.toFixed(2)}
                    </td>
                    <td className={cn("px-3 py-2 text-right tabular-nums", imp > 0 ? "text-success-fg" : imp < 0 ? "text-critical-fg" : "")}>
                      {r.model === "Naïve" ? "baseline" : `${imp > 0 ? "−" : "+"}${Math.abs(imp).toFixed(1)}%`}
                    </td>
                    <td className="px-3 py-2 text-xs text-muted-foreground">Reference</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <p className="text-xs text-muted-foreground">
          Ranked by WAPE. Selection rule: lowest WAPE on the 3-month rolling backtest, which matches the business decision (planning the next quarter).
          Click a row to inspect that model below. Status &quot;Reference&quot; = computed in Python by the executed notebook.
        </p>
      </div>

      <div className="grid gap-4 xl:grid-cols-2">
        <ChartCard
          testId="chart-holdout-errors"
          title="Hold-out MAPE (light) and WAPE (solid)"
          description="Error (%), 12-month hold-out Oct 2025 – Sep 2026."
          data={holdout.map((h) => ({ model: h.model, mape_pct: h.mape, wape_pct: h.wape }))}
          fileName="holdout-errors"
        >
          <ModelBars
            data={[...holdout].sort((a, b) => a.wape - b.wape).map((h) => ({ model: h.model, MAPE: h.mape, WAPE: h.wape }))}
            bars={[
              { key: "MAPE", label: "MAPE", opacity: 0.45 },
              { key: "WAPE", label: "WAPE", opacity: 1 },
            ]}
            xLabel="Error (%), lower is better"
            labelWidth={110}
          />
        </ChartCard>
        <ChartCard
          testId="chart-backtest-errors"
          title="Rolling 3-month-ahead backtest WAPE"
          description="Error (%), 18 origins × 3 months = 54 forecasts."
          data={backtest.map((h) => ({ model: h.model, mape_pct: h.mape, wape_pct: h.wape }))}
          fileName="backtest-errors"
        >
          <ModelBars
            data={[...backtest].sort((a, b) => a.wape - b.wape).map((h) => ({ model: h.model, WAPE: h.wape }))}
            bars={[{ key: "WAPE", label: "WAPE", opacity: 1 }]}
            xLabel="WAPE (%), lower is better"
            labelWidth={110}
            barSize={16}
          />
        </ChartCard>
      </div>

      <div id="actual-vs-predicted" className="scroll-mt-20 space-y-4">
        <h2 className="text-lg font-semibold tracking-tight">Task 6: actual vs predicted in the test year</h2>
        <ChartCard
          testId="chart-test-year"
          title="Actual vs predicted, 12-month hold-out"
          description="Index (2017 = 100). All models forecast Oct 2025 – Sep 2026 from the Sep 2025 origin. Toggle models in the legend."
          badges={
            <>
              <ProvenanceBadge kind="proxy" />
              <ProvenanceBadge kind="reference" />
            </>
          }
          data={testRows as Record<string, string | number | null>[]}
          fileName="test-year-actual-vs-predicted"
        >
          <TimeSeriesChart
            data={testRows}
            yLabel="Index (2017 = 100)"
            height={340}
            dividers={[{ x: testFrom, label: "test" }]}
            series={[
              { key: "Train", name: "Training data", style: "Training data" },
              { key: "Actual", name: "Actual", dots: true },
              ...holdout.map((h) => ({ key: h.model, name: h.model, emphasize: h.model === selected, defaultHidden: defaultHidden.has(h.model) && h.model !== selected })),
            ]}
          />
        </ChartCard>
        <ChartCard
          testId="chart-residuals"
          title={`Residuals of ${selected} in the test year`}
          description="Actual − forecast, index points. Bars above zero = under-forecast (stockout risk); below zero = over-forecast (excess stock)."
          toolbar={
            <label className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <span className="sr-only sm:not-sr-only">Model</span>
              <select
                className="h-7 rounded-md border border-input bg-card px-2 text-xs text-foreground"
                value={selected}
                onChange={(e) => setParam("model", e.target.value)}
                aria-label="Model for the residual plot"
              >
                {holdout.map((h) => (
                  <option key={h.model}>{h.model}</option>
                ))}
              </select>
            </label>
          }
          data={residuals[selected].map((r) => ({ month: r.month, residual: r.residual }))}
          fileName={`residuals-${selected}`}
        >
          <SignedColumns
            data={residuals[selected].map((r) => ({ month: r.month.slice(2), residual: r.residual }))}
            valueKey="residual"
            nameKey="month"
            yLabel="Actual − forecast"
            digits={2}
            positiveColor="var(--critical)"
            negativeColor="var(--m-hw)"
          />
        </ChartCard>
      </div>
    </div>
  );
}
