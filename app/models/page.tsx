import type { Metadata } from "next";
import { Suspense } from "react";
import { ModelBars } from "@/components/charts/bar-charts";
import { ChartCard } from "@/components/charts/chart-card";
import { PageHeader, Section } from "@/components/common/page-header";
import { PageSkeleton } from "@/components/common/page-skeleton";
import { ProvenanceBadge } from "@/components/common/provenance-badge";
import { SimpleTable } from "@/components/common/simple-table";
import { ModelExplorer } from "@/components/models/model-explorer";
import { REFERENCE_MODELS, holdoutScore, backtestScore, part2 } from "@/lib/data/reference";
import { residualRows, testRows } from "@/lib/data/views";

export const metadata: Metadata = {
  title: "Model Comparison",
  description: "Leaderboard, hold-out and backtest errors, actual vs predicted, residuals, seasonal-shape capture and feature importance.",
};

export default function ModelsPage() {
  const sec = part2.notebook_sections;
  const residuals = Object.fromEntries(REFERENCE_MODELS.map((m) => [m, residualRows(m) as { month: string; residual: number }[]]));
  const fi = part2.feature_importance;
  const fiRows = fi.features.map((f, i) => ({ feature: f, "Random Forest": fi.random_forest[i], XGBoost: fi.xgboost[i] }));

  return (
    <div className="space-y-10" data-testid="page-models">
      <PageHeader
        eyebrow={`Part 2 · Tasks 2, 5 and 6 (notebook §${sec.task2}, §${sec.task5}, §${sec.task6})`}
        title="Model comparison"
        description={`Six models from three families (benchmarks, statistical, machine learning), all fitted in Python by the executed notebook. ${part2.sarima.label} was chosen by AIC from ${part2.sarima.candidates} candidates on the training data only.`}
        badges={
          <>
            <ProvenanceBadge kind="reference" />
            <ProvenanceBadge kind="proxy" />
          </>
        }
      />

      <Suspense fallback={<PageSkeleton kpis={0} charts={2} />}>
        <ModelExplorer
          holdout={part2.holdout.scores}
          backtest={part2.backtest.scores}
          naiveHoldoutWape={holdoutScore("Naïve").wape}
          naiveBacktestWape={backtestScore("Naïve").wape}
          bestModel={part2.best_model}
          testRows={testRows(24)}
          residuals={residuals}
          testFrom={part2.split.test.from}
        />
      </Suspense>

      <Section
        id="shape"
        title="Seasonal-shape capture in the test year"
        notebookRef={sec.task7}
        description={`Each forecast is divided by its own mean and compared with the actual shape. The actual test year swung ${part2.shape.actual_amplitude_pct.toFixed(1)}% from trough to peak, peaking in ${part2.shape.actual_peak_month}.`}
      >
        <SimpleTable
          caption="Seasonal amplitude, shape correlation and peak month per model"
          rows={part2.shape.rows}
          highlight={(r) => r.model === part2.best_model}
          columns={[
            { key: "m", header: "Model", cell: (r) => r.model },
            { key: "a", header: "Amplitude (max/min − 1)", numeric: true, cell: (r) => `${r.amplitude_pct.toFixed(2)}%` },
            { key: "c", header: "Shape correlation", numeric: true, cell: (r) => (r.shape_corr === null ? "n/a (flat line)" : r.shape_corr.toFixed(2)) },
            { key: "p", header: "Peak month", cell: (r) => r.peak_month },
          ]}
        />
        <p className="text-sm text-muted-foreground">
          SARIMA reproduces the shape best (0.70, July peak) but carried the 2024–25 decline forward and under-forecast the level. XGBoost captures most of the
          swing (6.05% amplitude) and the level (bias +0.49%). Seasonal Naïve copied a distorted year (correlation −0.03).
        </p>
      </Section>

      <Section
        id="importance"
        title="Feature importance (tree models)"
        description={fi.note}
      >
        <ChartCard
          testId="chart-importance"
          title="Feature importance: Random Forest (teal) and XGBoost (purple)"
          description="Share of total importance (impurity / gain based)."
          badges={<ProvenanceBadge kind="reference">Computed by export script</ProvenanceBadge>}
          data={fiRows}
          fileName="feature-importance"
        >
          <ModelBars
            data={fiRows}
            nameKey="feature"
            bars={[
              { key: "Random Forest", label: "Random Forest", opacity: 1, color: "var(--m-rf)" },
              { key: "XGBoost", label: "XGBoost", opacity: 1, color: "var(--m-xgb)" },
            ]}
            xLabel="Importance (share)"
            unit=""
            digits={3}
            labelWidth={84}
          />
        </ChartCard>
      </Section>

      <Section id="sarima" title="SARIMA order selection (AIC)" notebookRef={sec.task2} description="Grid over p, q ∈ {0,1,2} and P, Q ∈ {0,1} with d = D = 1, s = 12, fitted on the training data only.">
        <SimpleTable
          caption="Five best SARIMA candidates by AIC"
          rows={part2.sarima.top5}
          highlight={(r) => r.order === "(1, 1, 2)" && r.seasonal_order === "(1, 1, 1, 12)"}
          columns={[
            { key: "o", header: "Order (p,d,q)", cell: (r) => r.order },
            { key: "s", header: "Seasonal (P,D,Q,s)", cell: (r) => r.seasonal_order },
            { key: "a", header: "AIC", numeric: true, cell: (r) => r.aic.toFixed(1) },
          ]}
          dense
        />
      </Section>
    </div>
  );
}
