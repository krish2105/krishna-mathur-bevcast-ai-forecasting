import Link from "next/link";
import { ArrowRight, BookOpen, Download, ExternalLink, GitBranch } from "lucide-react";
import { ExecutiveSummary } from "@/components/ai/executive-summary";
import { ChartCard } from "@/components/charts/chart-card";
import { TimeSeriesChart } from "@/components/charts/time-series-chart";
import { KpiCard } from "@/components/common/kpi-card";
import { Section } from "@/components/common/page-header";
import { ProvenanceBadge } from "@/components/common/provenance-badge";
import { Reveal } from "@/components/common/reveal";
import { Logo } from "@/components/layout/logo";
import { Button } from "@/components/ui/button";
import { backtestScore, holdoutScore, part1, part2 } from "@/lib/data/reference";
import { forecastHeroRows } from "@/lib/data/views";
import { monthLabel, num, pct, relativeImprovement } from "@/lib/format";
import { LINKS, NAV, STUDENT } from "@/lib/nav";

export default function OverviewPage() {
  const best = part2.best_model;
  const hBest = holdoutScore(best);
  const hNaive = holdoutScore("Naïve");
  const bBest = backtestScore(best);
  const bNaive = backtestScore("Naïve");
  const p1Best = part1.walk_forward.scores[0];
  const p1Naive = part1.walk_forward.scores.find((s) => s.model === "Naïve")!;
  const fut = part2.future.rows;
  const next = fut[0];
  const total3 = fut.reduce((a, r) => a + (r[best] as number), 0);
  const heroRows = forecastHeroRows(36, ["XGBoost", "SARIMA", "Holt-Winters", "Naïve"], ["XGBoost"]);
  const sparkTail = heroRows.filter((r) => typeof r.Actual === "number").slice(-12).map((r) => r.Actual as number);

  return (
    <div className="space-y-10">
      {/* Hero */}
      <Reveal>
        <section className="card-surface relative overflow-hidden p-6 md:p-8" aria-labelledby="hero-title">
          <div
            aria-hidden
            className="pointer-events-none absolute -top-24 -right-24 size-72 rounded-full opacity-[0.12] blur-3xl"
            style={{ background: "radial-gradient(circle, var(--primary), transparent 70%)" }}
          />
          <div className="relative grid gap-8 lg:grid-cols-[1.4fr_1fr]">
            <div className="min-w-0 space-y-4">
              <div className="flex items-center gap-3">
                <Logo className="size-10" />
                <div>
                  <p className="text-xs font-medium tracking-wide text-primary uppercase">AI in Operations · Problems and Exercises</p>
                  <h1 id="hero-title" className="text-3xl font-semibold tracking-tight md:text-4xl">
                    BEVCAST AI
                  </h1>
                </div>
              </div>
              <p className="text-lg font-medium text-balance">Forecast better. Produce smarter. Distribute with confidence.</p>
              <p className="max-w-2xl text-sm leading-relaxed text-muted-foreground text-pretty">
                AI in Operations: demand-forecasting studio (air coolers + flavored water). Part 1 compares a Naïve forecast with
                machine learning on the air-cooler lab data. Part 2 forecasts a new flavored-water product with six models,
                scores them with MAPE and WAPE, predicts the next three months and hands the results to an LLM copilot that
                reads live market and weather data.
              </p>
              <div className="flex flex-wrap gap-2">
                <ProvenanceBadge kind="simulated">Part 1 demand: simulated</ProvenanceBadge>
                <ProvenanceBadge kind="real">Dubai temperature: real</ProvenanceBadge>
                <ProvenanceBadge kind="proxy">Part 2: FRED category proxy</ProvenanceBadge>
                <ProvenanceBadge kind="live">Live feeds on request</ProvenanceBadge>
              </div>
              <div className="flex flex-wrap gap-2 pt-1">
                <Button asChild>
                  <a href={LINKS.colab} target="_blank" rel="noreferrer">
                    <BookOpen /> Open in Colab <ExternalLink className="size-3" />
                  </a>
                </Button>
                <Button asChild variant="outline">
                  <a href={LINKS.github} target="_blank" rel="noreferrer">
                    <GitBranch /> GitHub repository
                  </a>
                </Button>
                <Button asChild variant="outline">
                  <a href={LINKS.notebookDownload} download>
                    <Download /> Notebook (.ipynb)
                  </a>
                </Button>
              </div>
            </div>
            <dl className="grid grid-cols-[auto_1fr] content-start gap-x-4 gap-y-2 rounded-xl border border-border bg-muted/50 p-4 text-sm">
              {[
                ["Student", STUDENT.name],
                ["Roll number", STUDENT.roll],
                ["Programme", STUDENT.programme],
                ["Batch", STUDENT.batch],
                ["Institution", STUDENT.institution],
                ["Subject", STUDENT.subject],
                ["Assignment", STUDENT.assignment],
                ["Instructor", STUDENT.instructor],
              ].map(([k, v]) => (
                <div key={k} className="contents">
                  <dt className="text-muted-foreground">{k}</dt>
                  <dd className="min-w-0 font-medium">{v}</dd>
                </div>
              ))}
            </dl>
          </div>
        </section>
      </Reveal>

      {/* KPI row */}
      <Section title="Headline results" description="Reference results from the executed notebook. Models are chosen on out-of-sample error only.">
        <div className="grid auto-rows-fr grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-5" data-testid="kpi-row">
          <KpiCard
            label="Part 1 best model"
            value={pct(p1Best.wape)}
            unit="WAPE"
            sub={`${p1Best.model} · walk-forward ${part1.walk_forward.window}`}
            delta={{ text: `${num(p1Best.wape_change_vs_naive_pp)} pp vs Naïve (${pct(p1Naive.wape)})`, tone: "good", direction: "down" }}
            term="wape"
            badge={<ProvenanceBadge kind="simulated" />}
          />
          <KpiCard
            label="Part 2 best model"
            value={best}
            sub={`Hold-out MAPE ${pct(hBest.mape)} · WAPE ${pct(hBest.wape)}`}
            delta={{ text: `Lowest 3-month backtest WAPE (${pct(bBest.wape)})`, tone: "good", direction: "down" }}
            tip={part2.selection_rule}
            badge={<ProvenanceBadge kind="reference">Reference</ProvenanceBadge>}
          />
          <KpiCard
            label="Improvement vs Naïve"
            value={pct(relativeImprovement(hBest.wape, hNaive.wape), 1)}
            sub={`Hold-out WAPE ${pct(hBest.wape)} vs ${pct(hNaive.wape)} · 3-month backtest ${pct(relativeImprovement(bBest.wape, bNaive.wape), 1)}`}
            delta={{ text: "Relative WAPE reduction, 12-month hold-out", tone: "good", direction: "down" }}
            term="wapeImprovement"
          />
          <KpiCard
            label={`Next month (${monthLabel(next.month)})`}
            value={num(next[best] as number)}
            unit="index"
            sub={`SARIMA 95%: ${num(next.sarima_pi95[0], 1)} – ${num(next.sarima_pi95[1], 1)}`}
            spark={sparkTail}
            sparkColor="var(--m-xgb)"
            delta={{
              text: `${num(((next[best] as number) / part2.future.last_actual.value - 1) * 100, 1)}% vs ${monthLabel(part2.future.last_actual.month)} actual`,
              tone: "neutral",
              direction: (next[best] as number) < part2.future.last_actual.value ? "down" : "up",
            }}
            term="interval"
          />
          <KpiCard
            label="3-month total"
            value={num(total3)}
            unit="index-pts"
            sub={`${monthLabel(fut[0].month)} – ${monthLabel(fut[2].month)} · ${best}`}
            delta={{ text: "Category proxy: plan in relative terms", tone: "neutral", direction: "flat" }}
            term="proxy"
          />
        </div>
      </Section>

      {/* Hero chart */}
      <Reveal>
        <ChartCard
          testId="hero-chart"
          title="Actual vs forecast: soft-drink and bottled-water production"
          description="Index (2017 = 100), not seasonally adjusted. Last 36 months, the 12-month hold-out forecast and the next 3 months."
          badges={
            <>
              <ProvenanceBadge kind="proxy" />
              <ProvenanceBadge kind="reference">Reference (notebook)</ProvenanceBadge>
            </>
          }
          data={heroRows.map((r) => ({
            month: r.month as string,
            actual: (r.Actual as number) ?? null,
            xgboost_test_year: (r["XGBoost__test"] as number) ?? null,
            xgboost_next_3_months: (r["XGBoost__future"] as number) ?? null,
            sarima_next_3_months: (r["SARIMA__future"] as number) ?? null,
            sarima_pi95_low: Array.isArray(r.pi95) ? r.pi95[0] : null,
            sarima_pi95_high: Array.isArray(r.pi95) ? r.pi95[1] : null,
          }))}
          fileName="bevcast-actual-vs-forecast"
          footer={`Train | test split at ${monthLabel(part2.split.test.from)}; forecast origin ${monthLabel(part2.future.last_actual.month)}. Shaded: SARIMA 80% and 95% prediction intervals.`}
        >
          <TimeSeriesChart
            data={heroRows}
            yLabel="Index (2017 = 100)"
            height={340}
            series={[
              { key: "Actual", name: "Actual", dots: true },
              { key: "XGBoost__test", name: "XGBoost (test year)", style: "XGBoost (test year)" },
              { key: "XGBoost__future", name: "XGBoost (next 3 months)", style: "XGBoost", dots: true, emphasize: true },
              { key: "SARIMA__future", name: "SARIMA", style: "SARIMA", dots: true },
              { key: "Holt-Winters__future", name: "Holt-Winters", style: "Holt-Winters", dots: true, defaultHidden: true },
              { key: "Naïve__future", name: "Naïve", style: "Naïve", dots: true, defaultHidden: true },
            ]}
            bands={[
              { key: "pi95", name: "SARIMA 95%", color: "var(--m-sarima)", opacity: 0.08 },
              { key: "pi80", name: "SARIMA 80%", color: "var(--m-sarima)", opacity: 0.16 },
            ]}
            dividers={[
              { x: part2.split.test.from, label: "test" },
              { x: fut[0].month, label: "forecast" },
            ]}
          />
        </ChartCard>
      </Reveal>

      {/* AI summary */}
      <ExecutiveSummary />

      {/* Navigation */}
      <Section title="Explore the analysis" description="Every assignment task has a page. The compliance matrix maps each requirement to its evidence.">
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {NAV.filter((n) => n.href !== "/").map((n) => (
            <Link key={n.href} href={n.href} className="group card-surface flex items-start gap-3 p-4 transition-colors hover:border-primary/40">
              <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-accent text-accent-foreground">
                <n.icon className="size-4" aria-hidden />
              </span>
              <span className="min-w-0 flex-1">
                <span className="flex items-center justify-between gap-2 text-sm font-medium">
                  {n.title}
                  <ArrowRight className="size-4 text-muted-foreground transition-transform group-hover:translate-x-0.5" aria-hidden />
                </span>
                <span className="mt-0.5 block text-xs text-muted-foreground">{n.description}</span>
              </span>
            </Link>
          ))}
        </div>
      </Section>
    </div>
  );
}
