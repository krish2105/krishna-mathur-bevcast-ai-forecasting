import type { Metadata } from "next";
import { YearMonthHeatmap } from "@/components/analysis/heatmap";
import { SignedColumns } from "@/components/charts/bar-charts";
import { ChartCard } from "@/components/charts/chart-card";
import { TimeSeriesChart } from "@/components/charts/time-series-chart";
import { KpiCard } from "@/components/common/kpi-card";
import { PageHeader, Section } from "@/components/common/page-header";
import { ProvenanceBadge } from "@/components/common/provenance-badge";
import { SimpleTable } from "@/components/common/simple-table";
import { part2 } from "@/lib/data/reference";
import { annualRows, heatmapRows, historyRows, stlRows, yoyRows } from "@/lib/data/views";
import { monthLabel } from "@/lib/format";

export const metadata: Metadata = {
  title: "Sales Analysis",
  description: "Trend, STL decomposition, seasonal index, year × month heatmap and year-on-year growth of the FRED category proxy.",
};

const FEATURE_DEFS: Record<string, { def: string; why: string }> = {
  lag1: { def: "y(t−1)", why: "Most recent level" },
  lag2: { def: "y(t−2)", why: "Recent momentum" },
  lag3: { def: "y(t−3)", why: "Recent momentum" },
  lag12: { def: "y(t−12)", why: "Same month last year, carries seasonality" },
  roll3: { def: "Mean of last 3 months", why: "Smoothed short-term level" },
  roll12: { def: "Mean of last 12 months", why: "Annual level" },
  month_sin: { def: "sin(2π·m/12)", why: "Seasonal indicator (Dec and Jan stay neighbours)" },
  month_cos: { def: "cos(2π·m/12)", why: "Seasonal indicator" },
};

export default function AnalysisPage() {
  const sec = part2.notebook_sections;
  const hist = historyRows();
  const stl = stlRows();
  const si = part2.seasonal_index.map((s) => ({ month: s.month, pct: Math.round((s.index - 1) * 1000) / 10 }));
  const yoy = yoyRows(36);
  const annual = annualRows();
  const q = part2.series.quality;

  return (
    <div className="space-y-10" data-testid="page-analysis">
      <PageHeader
        eyebrow="Part 2 · Exploratory analysis"
        title="Sales analysis: trend, seasonality and growth"
        description="US soft-drink and bottled-water production (FRED IPN31211N), Jan 2012 – Sep 2026, used as the category proxy for the new flavored water. Not seasonally adjusted, so the real seasonal pattern is preserved."
        badges={
          <>
            <ProvenanceBadge kind="proxy" />
            <ProvenanceBadge kind="reference">Reference (notebook §{sec.eda})</ProvenanceBadge>
          </>
        }
      />

      <div className="grid auto-rows-fr grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <KpiCard label="Strength of trend" value={part2.decomposition.strength_trend.toFixed(2)} sub="STL, 0 = none, 1 = very strong" />
        <KpiCard label="Strength of seasonality" value={part2.decomposition.strength_seasonal.toFixed(2)} sub="Moderate, repeatable annual cycle" term="seasonalIndex" />
        <KpiCard
          label="Seasonal peak"
          value={`+${si.reduce((a, b) => (b.pct > a.pct ? b : a)).pct.toFixed(1)}%`}
          sub={`${si.reduce((a, b) => (b.pct > a.pct ? b : a)).month}; May–Sep run 1–3% above average`}
        />
        <KpiCard
          label="Largest YoY move"
          value={`${q.largest_yoy_moves[0].abs_yoy_pct.toFixed(1)}%`}
          sub={`${monthLabel(q.largest_yoy_moves[0].month)} (absolute change vs a year earlier)`}
        />
      </div>

      <Section
        id="history"
        title="History and trend"
        notebookRef={sec.eda}
        description="The level is not stable: about 111–112 in 2012–2015, down to about 93 by 2021, back to about 103 in 2023–2024 and down to about 95 in 2025–2026. The trend changes direction every few years, sometimes abruptly (late 2024)."
      >
        <ChartCard
          testId="chart-history"
          title="Monthly production index with 12-month centred moving average"
          description="Index (2017 = 100), not seasonally adjusted, Jan 2012 – Sep 2026."
          badges={<ProvenanceBadge kind="proxy" />}
          data={hist.map((r) => ({ month: r.month as string, index: r.Actual as number, trend_12m: (r.Trend as number | null) ?? null }))}
          fileName="fred-history-trend"
        >
          <TimeSeriesChart
            data={hist}
            yLabel="Index (2017 = 100)"
            height={300}
            series={[
              { key: "Actual", name: "Actual" },
              { key: "Trend", name: "12-month trend", style: "12-month trend" },
            ]}
          />
        </ChartCard>
      </Section>

      <Section
        id="decomposition"
        title="STL decomposition"
        notebookRef={sec.eda}
        description={`${part2.decomposition.method}. Trend strength ${part2.decomposition.strength_trend.toFixed(2)} and seasonal strength ${part2.decomposition.strength_seasonal.toFixed(2)}: getting the level right matters most at short horizons, with a moderate 12-month cycle on top.`}
      >
        <ChartCard
          title="Trend, seasonal and remainder components"
          description="Index points. Exported from the notebook's STL fit."
          data={stl as Record<string, string | number>[]}
          fileName="fred-stl"
        >
          <div className="space-y-1">
            {(["Trend", "Seasonal", "Remainder"] as const).map((k) => (
              <div key={k}>
                <p className="px-3 pt-1 text-xs font-medium text-muted-foreground">{k}</p>
                <TimeSeriesChart
                  data={stl}
                  yLabel={k === "Trend" ? "Index" : "Index pts"}
                  height={k === "Trend" ? 170 : 130}
                  legend={false}
                  valueDigits={2}
                  series={[{ key: k, name: k, style: k === "Trend" ? "12-month trend" : k === "Seasonal" ? "Holt-Winters" : "Training data" }]}
                />
              </div>
            ))}
          </div>
        </ChartCard>
      </Section>

      <Section
        id="seasonality"
        title="Monthly seasonal index"
        notebookRef={sec.eda}
        description="Average of actual ÷ centred 12-month moving average per calendar month, normalised so the average month = 1.00. Production runs about 1–3% above average from May to September and 2–3% below from November to January."
      >
        <div className="grid gap-4 xl:grid-cols-[1.4fr_1fr]">
          <ChartCard
            testId="chart-seasonal-index"
            title="Seasonal index: % above or below an average month"
            description="Above average in red-orange, below in blue; each bar is labelled."
            data={part2.seasonal_index.map((s, i) => ({ month: s.month, index: s.index, pct_vs_average: si[i].pct }))}
            fileName="seasonal-index"
          >
            <SignedColumns data={si} valueKey="pct" nameKey="month" yLabel="% vs average month" unit="%" digits={1} />
          </ChartCard>
          <SimpleTable
            caption="Seasonal index by month"
            rows={part2.seasonal_index}
            columns={[
              { key: "m", header: "Month", cell: (r) => r.month },
              { key: "i", header: "Index", numeric: true, cell: (r) => r.index.toFixed(3) },
              { key: "p", header: "vs average", numeric: true, cell: (r) => `${r.index >= 1 ? "+" : "−"}${Math.abs((r.index - 1) * 100).toFixed(1)}%` },
            ]}
            dense
          />
        </div>
      </Section>

      <Section id="heatmap" title="Year × month heatmap" description="Each cell is the index for that month. Read across a row for the seasonal shape, down a column for the trend.">
        <ChartCard
          testId="chart-heatmap"
          title="Production index by year and month"
          description="Index (2017 = 100). 2026 ends in September."
          data={heatmapRows().map((r) => ({ year: r.year, ...Object.fromEntries(r.values.map((v, i) => [`m${i + 1}`, v])) }))}
          fileName="fred-heatmap"
        >
          <div className="px-2 pb-2">
            <YearMonthHeatmap rows={heatmapRows()} />
          </div>
        </ChartCard>
      </Section>

      <Section
        id="growth"
        title="Year-on-year growth"
        notebookRef={sec.data}
        description={`Largest year-on-year moves in the notebook's data-quality check: ${q.largest_yoy_moves
          .map((m) => `${monthLabel(m.month)} ${m.abs_yoy_pct.toFixed(1)}%`)
          .join(", ")}. Summer 2025 fell 14–16% after an exceptionally strong summer 2024; the shock is real and is kept in the data.`}
      >
        <div className="grid gap-4 xl:grid-cols-[1.5fr_1fr]">
          <ChartCard
            title="Change vs the same month a year earlier, last 36 months"
            description="% (derived from the FRED values)."
            data={yoy.map((r) => ({ month: r.month as string, yoy_pct: r.yoy as number }))}
            fileName="fred-yoy"
          >
            <SignedColumns
              data={yoy.map((r) => ({ month: (r.month as string).slice(2), yoy: r.yoy as number }))}
              valueKey="yoy"
              nameKey="month"
              yLabel="YoY change (%)"
              unit="%"
              digits={1}
              showLabels={false}
              positiveColor="var(--m-rf)"
              negativeColor="var(--m-sarima)"
            />
          </ChartCard>
          <SimpleTable
            caption="Calendar-year averages"
            rows={[...annual].reverse()}
            maxHeight={360}
            columns={[
              { key: "y", header: "Year", cell: (r) => r.year },
              { key: "m", header: "Average index", numeric: true, cell: (r) => r.mean.toFixed(2) },
              { key: "n", header: "Months", numeric: true, cell: (r) => r.months },
              { key: "g", header: "YoY", numeric: true, cell: (r) => (r.yoy === null ? "n/a" : `${r.yoy > 0 ? "+" : ""}${r.yoy.toFixed(1)}%`) },
            ]}
            dense
          />
        </div>
      </Section>

      <Section
        id="features"
        title="Task 1: lag features and seasonal indicators"
        notebookRef={sec.task1}
        description={`Tree models do not understand time on their own, so the time-series structure is turned into columns. Every feature uses only information available before month t (no look-ahead leakage). Supervised dataset: ${part2.features.supervised_shape[0]} rows × ${part2.features.supervised_shape[1]} features; the first 12 months are used only as history.`}
      >
        <SimpleTable
          caption="Engineered features and their correlation with the target"
          rows={part2.features.list}
          columns={[
            { key: "f", header: "Feature", cell: (f) => <code className="font-mono text-xs">{f}</code> },
            { key: "d", header: "Definition", cell: (f) => FEATURE_DEFS[f]?.def ?? "" },
            { key: "w", header: "Why it helps", cell: (f) => FEATURE_DEFS[f]?.why ?? "" },
            { key: "c", header: "Correlation with target", numeric: true, cell: (f) => part2.features.correlation_with_target[f].toFixed(3) },
          ]}
        />
        <p className="text-xs text-muted-foreground">
          The month encodings look weakly correlated in a linear sense, but tree models use them non-linearly (for example &quot;if summer, add x&quot;).
        </p>
      </Section>
    </div>
  );
}
