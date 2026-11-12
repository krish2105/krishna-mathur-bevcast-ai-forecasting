import type { Metadata } from "next";
import { TriangleAlert } from "lucide-react";
import { ModelBars, StackedBars } from "@/components/charts/bar-charts";
import { ChartCard } from "@/components/charts/chart-card";
import { TimeSeriesChart } from "@/components/charts/time-series-chart";
import { KpiCard } from "@/components/common/kpi-card";
import { PageHeader, Section } from "@/components/common/page-header";
import { ProvenanceBadge } from "@/components/common/provenance-badge";
import { SimpleTable } from "@/components/common/simple-table";
import { DemandTempDualAxis, DemandTempScatter } from "@/components/part1/part1-charts";
import { part1 } from "@/lib/data/reference";
import { monthShort, num, pct } from "@/lib/format";

export const metadata: Metadata = {
  title: "Part 1 · Air-Cooler Lab",
  description: "Naïve vs Random Forest vs weather-adjusted regression for a seasonal product, scored with MAPE and WAPE.",
};

export default function AirCoolerLabPage() {
  const s = part1.notebook_sections;
  const rows = part1.monthly.map((m) => ({ month: m.month, demand: m.demand, temp: m.temp_mean_c }));
  const peak = part1.monthly.reduce((a, b) => (b.demand > a.demand ? b : a));
  const wf = part1.walk_forward;
  const rfIn = part1.in_sample.scores.find((x) => x.model.startsWith("Random Forest"))!;
  const naiveIn = part1.in_sample.scores.find((x) => x.model.startsWith("Naïve"))!;
  const rfOut = wf.scores.find((x) => x.model === "Random Forest (lags)")!;
  const naiveOut = wf.scores.find((x) => x.model === "Naïve")!;
  const best = wf.scores[0];
  const impactNaive = part1.impact.rows.find((r) => r.model === "Naïve")!;
  const impactBest = part1.impact.rows[0];

  const wfMonths = new Map(wf.rows.map((r) => [r.month as string, r]));
  const wfChart = part1.monthly.map((m) => {
    const r = wfMonths.get(m.month);
    const row: Record<string, string | number | null> = { month: m.month, Actual: m.demand };
    for (const k of wf.models) row[k] = r ? (r[k] as number) : null;
    return row;
  });
  const inChart = part1.monthly.map((m) => {
    const r = part1.in_sample.rows.find((x) => x.month === m.month);
    return { month: m.month, Actual: m.demand, "Naïve": r?.naive ?? null, "Random Forest (in-sample fit)": r?.rf_in_sample ?? null };
  });

  return (
    <div className="space-y-10" data-testid="page-lab-air-coolers">
      <PageHeader
        eyebrow="Part 1 · Session II Lab Activity (slide 57)"
        title="Retail demand forecasting for a seasonal product: air coolers"
        description="Objective from the slide: compare a baseline Naïve forecast with a machine learning model using MAPE and WAPE. The notebook reproduces the professor's reference method, then tests it honestly on unseen months and adds the real temperature driver."
        badges={
          <>
            <ProvenanceBadge kind="simulated">Demand: simulated teaching data</ProvenanceBadge>
            <ProvenanceBadge kind="real">Temperature: real (Open-Meteo, Dubai 2023)</ProvenanceBadge>
          </>
        }
      />

      <div className="grid auto-rows-fr grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <KpiCard label="Naïve, Feb–Dec" value={pct(part1.naive.wape)} unit="WAPE" sub={`MAPE ${pct(part1.naive.mape)}`} term="naive" />
        <KpiCard
          label="Random Forest, in-sample"
          value={pct(rfIn.wape)}
          unit="WAPE"
          sub={`MAPE ${pct(rfIn.mape)} · scored on its training months`}
          delta={{ text: "Fit score, misleading", tone: "bad", direction: "flat" }}
          term="inSample"
        />
        <KpiCard
          label="Random Forest, walk-forward"
          value={pct(rfOut.wape)}
          unit="WAPE"
          sub={`MAPE ${pct(rfOut.mape)} · Jul–Dec, unseen months`}
          delta={{ text: `+${num(rfOut.wape_change_vs_naive_pp)} pp vs Naïve`, tone: "bad", direction: "up" }}
          term="walkForward"
        />
        <KpiCard
          label="Weather-adjusted regression"
          value={pct(best.wape)}
          unit="WAPE"
          sub={`MAPE ${pct(best.mape)} · best out of sample`}
          delta={{ text: `${num(best.wape_change_vs_naive_pp)} pp vs Naïve (${pct(naiveOut.wape)})`, tone: "good", direction: "down" }}
          term="wape"
        />
      </div>

      <Section
        id="eda"
        title="Demand rises and falls with temperature"
        notebookRef="1.5–1.6"
        description={`Demand climbs from 80 units in January to a peak of ${peak.demand} in July and falls back to 90 by December. Temperature follows almost the same arc (Pearson r = ${part1.correlation.toFixed(2)}), but demand turns down in August while August stays as hot as July: the market saturates before the heat ends.`}
      >
        <div className="grid gap-4 xl:grid-cols-[1.4fr_1fr]">
          <ChartCard
            testId="chart-demand-temp"
            title="Monthly air-cooler demand and Dubai mean temperature, 2023"
            description="Left axis: demand (units). Right axis: mean temperature (°C)."
            badges={
              <>
                <ProvenanceBadge kind="simulated" />
                <ProvenanceBadge kind="real" />
              </>
            }
            data={part1.monthly.map((m) => ({ month: m.month, demand_units: m.demand, temp_mean_c: m.temp_mean_c, temp_max_c: m.temp_max_c }))}
            fileName="part1-demand-temperature"
          >
            <DemandTempDualAxis rows={rows} peak={{ month: peak.month, demand: peak.demand }} />
          </ChartCard>
          <ChartCard
            title={`Demand vs temperature (r = ${part1.correlation.toFixed(2)})`}
            description={`Linear fit: about ${part1.slope_units_per_c.toFixed(1)} more units per +1 °C. Autumn months sit below the line.`}
            data={rows.map((r) => ({ month: r.month, temperature_c: r.temp, demand_units: r.demand }))}
            fileName="part1-demand-vs-temperature"
          >
            <DemandTempScatter rows={rows} slope={part1.slope_units_per_c} intercept={part1.intercept} />
          </ChartCard>
        </div>
      </Section>

      <Section
        id="naive"
        title="Step 1: the Naïve baseline"
        notebookRef={s.naive}
        description="Forecast for next month = this month's actual. January has no forecast, so Feb–Dec are scored."
      >
        <div className="grid gap-4 lg:grid-cols-[1.3fr_1fr]">
          <SimpleTable
            caption="Naïve working table, Feb–Dec 2023"
            rows={part1.naive.rows}
            columns={[
              { key: "m", header: "Month", cell: (r) => monthShort(r.month) },
              { key: "d", header: "Demand", numeric: true, cell: (r) => r.demand },
              { key: "f", header: "Naïve forecast", numeric: true, cell: (r) => r.forecast.toFixed(0) },
              { key: "e", header: "|Error|", numeric: true, cell: (r) => r.abs_error.toFixed(0) },
              { key: "p", header: "|Error| %", numeric: true, cell: (r) => r.abs_pct_error.toFixed(2) },
            ]}
            dense
          />
          <div className="card-surface space-y-3 p-5 text-sm">
            <h3 className="font-semibold">Working</h3>
            <p>
              WAPE = Σ|error| / Σ demand = <strong>{part1.naive.sum_abs_error}</strong> / <strong>{part1.naive.sum_demand.toLocaleString()}</strong> ={" "}
              <strong>{pct(part1.naive.wape)}</strong>
            </p>
            <p>
              MAPE = average of the eleven monthly percentage errors = <strong>{pct(part1.naive.mape)}</strong>
            </p>
            <p className="text-muted-foreground">
              Naïve is always one month late: it under-forecasts every month while demand rises (Feb–Jul), causing stockouts, and
              over-forecasts every month while demand falls (Aug–Dec), leaving excess stock at the end of the season.
            </p>
          </div>
        </div>
      </Section>

      <Section
        id="in-sample"
        title="Step 2: why the in-sample score misleads"
        notebookRef={s.in_sample}
        description="The reference approach trains a Random Forest on lags 1–2 and scores it on the same months it learned from."
      >
        <div className="flex items-start gap-3 rounded-xl border border-warning/40 bg-warning/10 p-4 text-sm text-foreground">
          <TriangleAlert className="mt-0.5 size-4 shrink-0 text-warning-fg" aria-hidden />
          <div className="space-y-1">
            <p className="font-semibold text-warning-fg">In-sample accuracy is a fit score, not a forecasting score</p>
            <p>
              Scored on its own training months (Mar–Dec) the Random Forest reaches MAPE {pct(rfIn.mape)} vs Naïve {pct(naiveIn.mape)}.
              With 100 trees and ten rows it can nearly memorise the data. Asked to forecast months it has not seen (walk-forward Jul–Dec) it
              becomes the worst model: MAPE {pct(rfOut.mape)}, WAPE {pct(rfOut.wape)} vs Naïve {pct(naiveOut.mape)} / {pct(naiveOut.wape)}.
              Trees cannot predict below the range they were trained on, so after the July peak they keep forecasting summer levels.
            </p>
          </div>
        </div>
        <ChartCard
          title="Reference approach: Random Forest scored on its own training months"
          description="Units. In-sample fit, Mar–Dec 2023."
          data={inChart.map((r) => ({ month: r.month, actual: r.Actual, naive: r["Naïve"], rf_in_sample: r["Random Forest (in-sample fit)"] }))}
          fileName="part1-in-sample"
          badges={<ProvenanceBadge kind="simulated" />}
        >
          <TimeSeriesChart
            data={inChart}
            yLabel="Demand (units)"
            height={260}
            valueDigits={1}
            xFormat={undefined}
            series={[
              { key: "Actual", name: "Actual", dots: true },
              { key: "Naïve", name: "Naïve" },
              { key: "Random Forest (in-sample fit)", name: "Random Forest (in-sample fit)" },
            ]}
          />
        </ChartCard>
      </Section>

      <Section
        id="walk-forward"
        title="Step 3: fair out-of-sample comparison (walk-forward, Jul–Dec)"
        notebookRef={s.walk_forward}
        description={`${wf.design} Weather-adjusted model: next month = last month + α + β × change in temperature (full-year fit: α = ${wf.weather_regression_full_year.intercept}, β = ${wf.weather_regression_full_year.beta}).`}
      >
        <div className="grid gap-4 xl:grid-cols-[1.5fr_1fr]">
          <ChartCard
            testId="chart-walk-forward"
            title="Walk-forward one-step-ahead forecasts, Jul–Dec 2023"
            description="Units. Shaded: out-of-sample test window."
            badges={<ProvenanceBadge kind="simulated" />}
            data={wf.rows as Record<string, string | number>[]}
            fileName="part1-walk-forward"
          >
            <TimeSeriesChart
              data={wfChart}
              yLabel="Demand (units)"
              height={300}
              valueDigits={1}
              regions={[{ x1: "2023-07", x2: "2023-12", label: "out-of-sample" }]}
              series={[
                { key: "Actual", name: "Actual", dots: true },
                ...wf.models.map((m) => ({ key: m, name: m, dots: true, emphasize: m === best.model })),
              ]}
            />
          </ChartCard>
          <ChartCard
            testId="chart-p1-metrics"
            title="Out-of-sample MAPE (light) and WAPE (solid)"
            description="Error (%), lower is better."
            data={wf.scores.map((x) => ({ model: x.model, mape_pct: x.mape, wape_pct: x.wape, wape_change_vs_naive_pp: x.wape_change_vs_naive_pp }))}
            fileName="part1-walk-forward-metrics"
          >
            <ModelBars
              data={wf.scores.map((x) => ({ model: x.model, MAPE: x.mape, WAPE: x.wape }))}
              bars={[
                { key: "MAPE", label: "MAPE", opacity: 0.45 },
                { key: "WAPE", label: "WAPE", opacity: 1 },
              ]}
              xLabel="Error (%), lower is better"
              labelWidth={128}
              digits={1}
            />
          </ChartCard>
        </div>
      </Section>

      <Section
        id="impact"
        title="Step 4: operational impact on inventory"
        notebookRef={s.impact}
        description={`If the company stocks exactly what each forecast says, under-forecasts become stockouts and over-forecasts become excess stock. Jul–Dec demand totals ${part1.impact.total_demand_jul_dec} units.`}
      >
        <div className="grid gap-4 xl:grid-cols-[1.3fr_1fr]">
          <ChartCard
            testId="chart-impact"
            title="Where each model's errors end up: stockouts vs excess stock"
            description="Units mis-planned, Jul–Dec 2023."
            data={part1.impact.rows}
            fileName="part1-impact"
          >
            <StackedBars
              data={part1.impact.rows.map((r) => ({ model: r.model, stockout: r.stockout_units, excess: r.excess_units }))}
              stacks={[
                { key: "stockout", label: "Stockout units (under-forecast)", color: "var(--critical)" },
                { key: "excess", label: "Excess units (over-forecast)", color: "var(--m-ma)" },
              ]}
              xLabel="Units mis-planned"
              labelWidth={150}
            />
            <div className="flex flex-wrap gap-4 px-2 pb-1 text-xs text-muted-foreground">
              <span className="flex items-center gap-1.5">
                <span className="size-2.5 rounded-sm bg-critical" aria-hidden /> Stockout units
              </span>
              <span className="flex items-center gap-1.5">
                <span className="size-2.5 rounded-sm" style={{ background: "var(--m-ma)" }} aria-hidden /> Excess units
              </span>
            </div>
          </ChartCard>
          <SimpleTable
            caption="Units mis-planned, Jul–Dec"
            rows={part1.impact.rows}
            highlight={(r) => r.model === impactBest.model}
            columns={[
              { key: "m", header: "Model", cell: (r) => r.model },
              { key: "s", header: "Stockout", numeric: true, cell: (r) => r.stockout_units.toFixed(1) },
              { key: "e", header: "Excess", numeric: true, cell: (r) => r.excess_units.toFixed(1) },
              { key: "t", header: "Total", numeric: true, cell: (r) => r.total_units.toFixed(1) },
              { key: "p", header: "% of demand", numeric: true, cell: (r) => r.share_pct.toFixed(1) },
            ]}
          />
        </div>
        <p className="text-sm text-muted-foreground">
          The weather-adjusted plan mis-plans {impactBest.total_units.toFixed(1)} units vs {impactNaive.total_units.toFixed(1)} for Naïve, cutting excess
          stock from {impactNaive.excess_units.toFixed(0)} to {impactBest.excess_units.toFixed(1)} units at the cost of{" "}
          {(impactBest.stockout_units - impactNaive.stockout_units).toFixed(1)} more stockout units.
        </p>
      </Section>

      <Section id="findings" title="Key findings and recommendations" notebookRef={`${s.findings}–${s.conclusion}`}>
        <div className="grid gap-4 lg:grid-cols-2">
          <div className="card-surface p-5">
            <h3 className="mb-3 font-semibold">Findings</h3>
            <ol className="list-decimal space-y-2 pl-5 text-sm">
              <li>
                Baseline: Naïve has MAPE {pct(part1.naive.mape)} and WAPE {pct(part1.naive.wape)} over Feb–Dec. It lags the season by one month in both
                directions.
              </li>
              <li>The in-sample Random Forest appears to beat Naïve (≈{rfIn.mape.toFixed(1)}% vs {naiveIn.mape.toFixed(1)}% MAPE), but that is a fitting score.</li>
              <li>In walk-forward validation the lag-only Random Forest is the worst model: it cannot follow the post-peak decline.</li>
              <li>A simple weather-adjusted regression using real temperature gives the lowest MAPE and WAPE out of sample and the fewest mis-planned units.</li>
              <li>Demand saturates before temperature peaks: sales turn down in August although August is as hot as July.</li>
            </ol>
          </div>
          <div className="card-surface p-5">
            <h3 className="mb-3 font-semibold">Recommendations for the retailer</h3>
            <ul className="list-disc space-y-2 pl-5 text-sm">
              <li>Use temperature as a leading input (for example a 30-day outlook), not only last month&apos;s sales.</li>
              <li>Front-load inventory in March–June and cut replenishment as soon as July demand stops growing, not when temperatures fall.</li>
              <li>Record promotions (dates, discount depth) so their effect can be separated from temperature next season.</li>
              <li>Collect two to three seasons of data before relying on tree-based ML; with 12 points, simple well-specified models are safer.</li>
              <li>Always validate on unseen periods (walk-forward): in-sample accuracy can recommend the wrong model.</li>
            </ul>
          </div>
        </div>
        <p className="text-xs text-muted-foreground">
          Limitations: the demand series is simulated teaching data; only six out-of-sample months are scored; forecast-month temperature is assumed
          known; no promotion data were provided.
        </p>
      </Section>
    </div>
  );
}
