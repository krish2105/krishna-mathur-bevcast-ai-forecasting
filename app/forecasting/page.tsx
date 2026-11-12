import type { Metadata } from "next";
import { Suspense } from "react";
import { PageHeader } from "@/components/common/page-header";
import { PageSkeleton } from "@/components/common/page-skeleton";
import { ProvenanceBadge } from "@/components/common/provenance-badge";
import { ForecastLab } from "@/components/forecasting/forecast-lab";
import { categoryIndex, fredMonths, fredValues, part2 } from "@/lib/data/reference";
import { forecastHeroRows } from "@/lib/data/views";

export const metadata: Metadata = {
  title: "Forecasting Lab",
  description: "Train, evaluate and forecast exactly the next 3 months with interval bands, on the reference data or your own upload.",
};

export default function ForecastingPage() {
  const ref = {
    heroRows: forecastHeroRows(36, part2.models, []),
    future: part2.future.rows.map((r) => ({
      month: r.month,
      values: Object.fromEntries(part2.models.map((m) => [m, r[m] as number])),
      pi80: r.sarima_pi80 as [number, number],
      pi95: r.sarima_pi95 as [number, number],
    })),
    holdout: part2.holdout.scores,
    backtest: part2.backtest.scores,
    bestModel: part2.best_model,
    models: part2.models,
  };
  return (
    <div className="space-y-8" data-testid="page-forecasting">
      <PageHeader
        eyebrow={`Part 2 · Tasks 3–5 (notebook §${part2.notebook_sections.task3}–${part2.notebook_sections.task5})`}
        title="Forecasting lab"
        description="Run the in-app engine (TypeScript, computed live in your browser) on the reference series or your upload: chronological hold-out, rolling-origin backtest and exactly 3 future months with empirical interval bands. The notebook's Python results are on the second tab and are never mixed with the engine's numbers."
        badges={
          <>
            <ProvenanceBadge kind="engine" />
            <ProvenanceBadge kind="reference" />
          </>
        }
      />
      <Suspense fallback={<PageSkeleton kpis={0} charts={2} />}>
        <ForecastLab reference={{ months: fredMonths, values: fredValues }} categoryIndex={categoryIndex} refBundle={ref} />
      </Suspense>
    </div>
  );
}
