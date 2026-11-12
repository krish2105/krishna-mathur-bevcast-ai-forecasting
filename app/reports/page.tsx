import type { Metadata } from "next";
import { Download } from "lucide-react";
import { PageHeader, Section } from "@/components/common/page-header";
import { ProvenanceBadge } from "@/components/common/provenance-badge";
import { SimpleTable } from "@/components/common/simple-table";
import { PrintButton, ReportInterpretation } from "@/components/reports/report-actions";
import { Button } from "@/components/ui/button";
import { part1, part2 } from "@/lib/data/reference";
import { monthLabel } from "@/lib/format";
import { STUDENT } from "@/lib/nav";

export const metadata: Metadata = {
  title: "Reports",
  description: "Download forecasts, metrics and the leaderboard as CSV, or print the full report.",
};

const DOWNLOADS = [
  { type: "forecasts", label: "Next-3-month forecasts", desc: "All six reference models + SARIMA 80/95% intervals" },
  { type: "metrics", label: "Metrics (Part 2)", desc: "MAPE, WAPE, RMSE, bias: hold-out and backtest" },
  { type: "leaderboard", label: "Model leaderboard", desc: "Ranked by 3-month backtest WAPE" },
  { type: "backtest", label: "Backtest detail", desc: "54 forecasts: origin, target, actual, every model" },
  { type: "part1", label: "Part 1 results", desc: "Naïve, in-sample and walk-forward MAPE/WAPE" },
];

export default function ReportsPage() {
  const best = part2.best_model;
  return (
    <div className="space-y-10" data-testid="page-reports">
      <PageHeader
        title="Reports"
        description="Every file below is generated from the notebook's exported results. The printable report (Print / Save as PDF) includes the LLM interpretation with its source label."
        actions={<PrintButton />}
      />

      <Section id="downloads" title="CSV downloads" className="no-print">
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3" data-print-hide>
          {DOWNLOADS.map((d) => (
            <div key={d.type} className="card-surface flex items-start justify-between gap-3 p-4">
              <div>
                <p className="text-sm font-medium">{d.label}</p>
                <p className="text-xs text-muted-foreground">{d.desc}</p>
              </div>
              <Button asChild size="sm" variant="outline">
                <a href={`/api/report?type=${d.type}`} download data-testid={`download-${d.type}`}>
                  <Download /> CSV
                </a>
              </Button>
            </div>
          ))}
        </div>
      </Section>

      <article className="card-surface space-y-8 p-6 md:p-8" aria-labelledby="report-title" data-testid="printable-report">
        <header className="flex flex-col gap-3 border-b border-border pb-5 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <p className="text-xs font-medium tracking-wide text-primary uppercase">{STUDENT.institution}</p>
            <h2 id="report-title" className="text-xl font-semibold">
              BEVCAST AI: demand-forecasting report
            </h2>
            <p className="text-sm text-muted-foreground">{STUDENT.subject} · Problems and Exercises: Session II Lab Activity and Exercise</p>
          </div>
          <div className="text-sm sm:text-right">
            <p className="font-medium">{STUDENT.name}</p>
            <p className="text-muted-foreground">
              {STUDENT.roll} · {STUDENT.programme} {STUDENT.batch}
            </p>
          </div>
        </header>

        <section className="space-y-3">
          <h3 className="font-semibold">1. Part 1: air coolers (walk-forward, Jul–Dec 2023)</h3>
          <div className="flex flex-wrap gap-2">
            <ProvenanceBadge kind="simulated" />
            <ProvenanceBadge kind="real">Real temperature</ProvenanceBadge>
          </div>
          <SimpleTable
            caption="Part 1 out-of-sample scores"
            rows={part1.walk_forward.scores}
            dense
            columns={[
              { key: "m", header: "Model", cell: (r) => r.model },
              { key: "a", header: "MAPE %", numeric: true, cell: (r) => r.mape.toFixed(2) },
              { key: "w", header: "WAPE %", numeric: true, cell: (r) => r.wape.toFixed(2) },
              { key: "c", header: "WAPE vs Naïve (pp)", numeric: true, cell: (r) => r.wape_change_vs_naive_pp.toFixed(2) },
            ]}
          />
          <p className="text-sm text-muted-foreground">
            Naïve Feb–Dec: MAPE {part1.naive.mape.toFixed(2)}%, WAPE {part1.naive.wape.toFixed(2)}%. The in-sample Random Forest (MAPE{" "}
            {part1.in_sample.scores[0].mape.toFixed(2)}%) only looked good because it was scored on its training months.
          </p>
        </section>

        <section className="space-y-3">
          <h3 className="font-semibold">2. Part 2: model performance (FRED IPN31211N category proxy)</h3>
          <div className="grid gap-4 lg:grid-cols-2">
            {[
              { t: "Hold-out, 12 months", rows: part2.holdout.scores },
              { t: "Rolling backtest, 54 forecasts", rows: part2.backtest.scores },
            ].map((x) => (
              <div key={x.t} className="space-y-1.5">
                <p className="text-sm font-medium">{x.t}</p>
                <SimpleTable
                  caption={x.t}
                  rows={x.rows}
                  dense
                  highlight={(r) => r.model === best}
                  columns={[
                    { key: "m", header: "Model", cell: (r) => r.model },
                    { key: "a", header: "MAPE %", numeric: true, cell: (r) => r.mape.toFixed(2) },
                    { key: "w", header: "WAPE %", numeric: true, cell: (r) => r.wape.toFixed(2) },
                    { key: "b", header: "Bias %", numeric: true, cell: (r) => r.bias_pct.toFixed(2) },
                  ]}
                />
              </div>
            ))}
          </div>
        </section>

        <section className="space-y-3">
          <h3 className="font-semibold">3. Forecast: next 3 months ({best})</h3>
          <SimpleTable
            caption="Next 3 months forecast"
            rows={part2.future.rows}
            dense
            columns={[
              { key: "m", header: "Month", cell: (r) => monthLabel(r.month) },
              { key: "f", header: `${best} forecast`, numeric: true, cell: (r) => (r[best] as number).toFixed(2) },
              { key: "p8", header: "SARIMA 80%", numeric: true, cell: (r) => `${r.sarima_pi80[0].toFixed(2)} – ${r.sarima_pi80[1].toFixed(2)}` },
              { key: "p9", header: "SARIMA 95%", numeric: true, cell: (r) => `${r.sarima_pi95[0].toFixed(2)} – ${r.sarima_pi95[1].toFixed(2)}` },
            ]}
          />
        </section>

        <section className="space-y-3">
          <h3 className="font-semibold">4. LLM interpretation</h3>
          <ReportInterpretation />
        </section>

        <section className="space-y-2">
          <h3 className="font-semibold">5. Recommendations</h3>
          <ol className="list-decimal space-y-1 pl-5 text-sm">
            <li>Plan the next quarter with {best}; size buffers with the SARIMA interval rather than a single number.</li>
            <li>Build inventory ahead of the May–September season and wind production down from October.</li>
            <li>For the new flavored water, use category seasonal-index transfer in year one (WAPE {part2.first_year.scores[0].wape.toFixed(2)}% vs Naïve {part2.first_year.scores.find((s) => s.model.startsWith("Naïve"))!.wape.toFixed(2)}%).</li>
            <li>Add a weather trigger to short-term replenishment; track MAPE and WAPE monthly and keep Naïve as a benchmark.</li>
            <li>Air coolers: use temperature as a leading input and cut replenishment as soon as demand stops growing.</li>
          </ol>
          <p className="text-xs text-muted-foreground">Recommendations are suggestions for planners, not executed actions.</p>
        </section>

        <footer className="border-t border-border pt-3 text-xs text-muted-foreground">
          {STUDENT.name} · {STUDENT.roll} · {STUDENT.programme} {STUDENT.batch} · AI in Operations: Problems and Exercises
        </footer>
      </article>
    </div>
  );
}
