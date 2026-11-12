import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { ChartCard } from "@/components/charts/chart-card";
import { TimeSeriesChart } from "@/components/charts/time-series-chart";
import { PageHeader, Section } from "@/components/common/page-header";
import { ProvenanceBadge } from "@/components/common/provenance-badge";
import { SimpleTable } from "@/components/common/simple-table";
import { PlanWhatIf } from "@/components/insights/plan-whatif";
import { backtestScore, holdoutScore, part2 } from "@/lib/data/reference";
import { firstYearRows } from "@/lib/data/views";
import { monthLabel, pct } from "@/lib/format";

export const metadata: Metadata = {
  title: "Insights & Planning",
  description: "Task 7: seasonality and trend capture, the best model and why, recommendations, the first-year scenario and a 3-month production plan.",
};

function Answer({ n, q, children, href, linkLabel }: { n: number; q: string; children: React.ReactNode; href: string; linkLabel: string }) {
  return (
    <article className="card-surface flex flex-col gap-3 p-5">
      <p className="text-xs font-medium tracking-wide text-primary uppercase">Question {n}</p>
      <h3 className="text-base font-semibold text-balance">{q}</h3>
      <div className="flex-1 space-y-2 text-sm leading-relaxed">{children}</div>
      <Link href={href} className="inline-flex items-center gap-1 text-sm font-medium text-primary hover:underline">
        {linkLabel} <ArrowRight className="size-3.5" aria-hidden />
      </Link>
    </article>
  );
}

export default function InsightsPage() {
  const sec = part2.notebook_sections;
  const best = part2.best_model;
  const hb = holdoutScore(best);
  const hn = holdoutScore("Naïve");
  const hHW = holdoutScore("Holt-Winters");
  const hS = holdoutScore("SARIMA");
  const bb = backtestScore(best);
  const bn = backtestScore("Naïve");
  const bHW = backtestScore("Holt-Winters");
  const shape = Object.fromEntries(part2.shape.rows.map((r) => [r.model, r]));
  const fy = part2.first_year.scores;
  const fyRows = firstYearRows();
  const coldNames = Object.keys(fyRows.at(-1)!).filter((k) => !["month", "Actual", "First year (training)"].includes(k));
  const planRows = part2.future.rows.map((r) => ({
    month: r.month,
    forecast: r[best] as number,
    pi80: r.sarima_pi80 as [number, number],
    pi95: r.sarima_pi95 as [number, number],
  }));

  return (
    <div className="space-y-10" data-testid="page-insights">
      <PageHeader
        eyebrow={`Part 2 · Task 7 (notebook §${sec.task7}, §${sec.recommendations})`}
        title="Insights and production planning"
        description="Evidence-based answers to the three interpretation questions, what the new product can do with only its first year of data, and a 3-month production and distribution plan."
        badges={
          <>
            <ProvenanceBadge kind="reference" />
            <ProvenanceBadge kind="proxy" />
          </>
        }
      />

      <div className="grid gap-4 lg:grid-cols-3">
        <Answer n={1} q="How well did the models capture seasonality or trends?" href="/models#shape" linkLabel="See the seasonal-shape table">
          <p>
            The actual test year swung {part2.shape.actual_amplitude_pct.toFixed(1)}% and peaked in {part2.shape.actual_peak_month}.{" "}
            <strong>SARIMA</strong> reproduced the shape best (correlation {shape.SARIMA.shape_corr?.toFixed(2)}, {shape.SARIMA.peak_month} peak) but
            carried the 2024–25 decline forward, so it under-forecast the level (bias {pct(hS.bias_pct)}).
          </p>
          <p>
            <strong>Holt-Winters</strong> was close on shape ({shape["Holt-Winters"].shape_corr?.toFixed(2)}). <strong>XGBoost</strong> caught most of the
            swing ({shape.XGBoost.amplitude_pct.toFixed(2)}% amplitude, correlation {shape.XGBoost.shape_corr?.toFixed(2)}) and the level (bias{" "}
            {pct(hb.bias_pct)}). Naïve is flat; Seasonal Naïve copied a distorted year (correlation {shape["Seasonal Naïve"].shape_corr?.toFixed(2)}).
          </p>
        </Answer>
        <Answer n={2} q="Which model performed best and why?" href="/models" linkLabel="Open the leaderboard">
          <p>
            <strong>{best}</strong> won both tests: hold-out WAPE {pct(hb.wape)} vs Naïve {pct(hn.wape)} (about{" "}
            {((1 - hb.wape / hn.wape) * 100).toFixed(0)}% better) and 3-month backtest WAPE {pct(bb.wape)} vs Naïve {pct(bn.wape)}.
          </p>
          <p>
            Why: it is the only model that got both the level and the season right; shallow, regularised trees (depth 3, learning rate 0.05) avoid
            over-fitting 165 rows; and the Task 1 features give it last month, the last quarter and the same month last year.
          </p>
          <p className="text-muted-foreground">
            Caveats: the 3-month margin over Naïve is small. Holt-Winters was second on the hold-out ({pct(hHW.wape)}) but fifth on the backtest (
            {pct(bHW.wape)}): one test window is not enough to choose a model.
          </p>
        </Answer>
        <Answer n={3} q="What recommendations would you give the company?" href="#plan" linkLabel="See the 3-month plan">
          <ol className="list-decimal space-y-1.5 pl-4">
            <li>Plan the next quarter with {best} and size buffers with the SARIMA interval, not a single number.</li>
            <li>Build inventory ahead of the May–September season; secure capacity and packaging from about March, wind down from October.</li>
            <li>For the new flavored water, use seasonal-index transfer in year one; switch to SARIMA or Holt-Winters after 24+ months.</li>
            <li>Add a weather trigger: when the 16-day outlook is notably warmer than last year, pull shipments forward to hot regions.</li>
            <li>Track MAPE and WAPE monthly, retrain monthly and keep Naïve as a permanent benchmark.</li>
            <li>Start recording drivers (price, promotions, distribution points, regional temperature).</li>
          </ol>
        </Answer>
      </div>

      <Section
        id="first-year"
        title="The company's real situation: only the first year of sales"
        notebookRef="2.12.3"
        description={`${part2.first_year.label} (${monthLabel(part2.first_year.window.from)} – ${monthLabel(
          part2.first_year.window.to,
        )}). With 12 points SARIMA, Holt-Winters and lag-12 features cannot be estimated, so three realistic methods are compared on the following 12 months.`}
      >
        <div className="grid gap-4 xl:grid-cols-[1.5fr_1fr]">
          <ChartCard
            testId="chart-first-year"
            title="Forecasting with only one year of history"
            description="Index (2017 = 100). Grey: the product's 'first year' (training)."
            badges={<ProvenanceBadge kind="reference" />}
            data={fyRows as Record<string, string | number | null>[]}
            fileName="first-year-scenario"
          >
            <TimeSeriesChart
              data={fyRows}
              yLabel="Index (2017 = 100)"
              height={300}
              dividers={[{ x: part2.split.test.from, label: "forecast" }]}
              series={[
                { key: "First year (training)", name: "First year (training)", style: "First year (training)", dots: true },
                { key: "Actual", name: "Actual", dots: true },
                ...coldNames.map((k) => ({ key: k, name: k, emphasize: k.startsWith("Seasonal-index") })),
              ]}
            />
          </ChartCard>
          <div className="space-y-3">
            <SimpleTable
              caption="First-year-only scenario scores"
              rows={fy}
              highlight={(r) => r.model.startsWith("Seasonal-index")}
              columns={[
                { key: "m", header: "Method", cell: (r) => <span className="whitespace-normal">{r.model}</span>, className: "min-w-[180px]" },
                { key: "w", header: "WAPE %", numeric: true, cell: (r) => r.wape.toFixed(2) },
                { key: "p", header: "MAPE %", numeric: true, cell: (r) => r.mape.toFixed(2) },
              ]}
            />
            <p className="text-sm text-muted-foreground">
              Borrowing the category&apos;s seasonal shape and estimating the level from the product&apos;s own sales is the only one-year method that
              anticipates the summer peak and the winter dip. The small Random Forest has too few rows to learn beyond &quot;repeat recent values&quot;.
            </p>
          </div>
        </div>
      </Section>

      <Section
        id="plan"
        title="Production and distribution plan: next 3 months"
        notebookRef={sec.task4}
        description={`Base: the selected model's forecast (${best}) from the ${monthLabel(part2.future.last_actual.month)} origin (last actual ${part2.future.last_actual.value.toFixed(
          2,
        )}). Use the what-if controls to test a demand shock or a warm spell.`}
      >
        <PlanWhatIf rows={planRows} lastActual={part2.future.last_actual.value} model={best} />
      </Section>
    </div>
  );
}
