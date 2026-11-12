import type { Metadata } from "next";
import { ExternalLink } from "lucide-react";
import { KpiCard } from "@/components/common/kpi-card";
import { PageHeader, Section } from "@/components/common/page-header";
import { ProvenanceBadge } from "@/components/common/provenance-badge";
import { SimpleTable } from "@/components/common/simple-table";
import { UploadWorkspace } from "@/components/data/upload-workspace";
import { part2, series } from "@/lib/data/reference";
import { seriesQuality } from "@/lib/data/quality";
import { monthLabel } from "@/lib/format";

export const metadata: Metadata = {
  title: "Data Workspace",
  description: "Reference dataset card, data-quality report and a browser-only CSV upload with column mapping and validation.",
};

export default function DataPage() {
  const s = part2.series;
  const q = seriesQuality(series.fred_monthly);
  const nbq = s.quality;
  const checks = [
    { check: "Rows (analysis window)", app: String(q.rows), notebook: String(s.window.n_months) },
    { check: "Missing values", app: String(q.missing), notebook: String(nbq.missing) },
    { check: "Duplicate months", app: String(q.duplicates), notebook: String(nbq.duplicates) },
    { check: "Regular monthly frequency", app: q.frequency === "MS" ? "Yes (MS)" : "No", notebook: nbq.frequency === "MS" ? "Yes (MS)" : nbq.frequency },
    ...q.largestYoyMoves.map((m, i) => ({
      check: `Largest YoY move #${i + 1}`,
      app: `${monthLabel(m.month)}: ${m.absYoyPct.toFixed(1)}%`,
      notebook: `${monthLabel(nbq.largest_yoy_moves[i].month)}: ${nbq.largest_yoy_moves[i].abs_yoy_pct.toFixed(1)}%`,
    })),
    { check: "Mean / min / max", app: `${q.mean.toFixed(2)} / ${q.min.toFixed(2)} / ${q.max.toFixed(2)}`, notebook: `${s.stats.mean.toFixed(2)} / ${s.stats.min.toFixed(2)} / ${s.stats.max.toFixed(2)}` },
  ];

  return (
    <div className="space-y-10" data-testid="page-data">
      <PageHeader
        eyebrow={`Part 2 · Dataset (notebook §${part2.notebook_sections.data})`}
        title="Data workspace"
        description="No dataset was handed out with the exercise slide, and a brand's own flavored-water sales are not public. Instead of inventing numbers, the notebook uses the closest real, official, monthly series for the category."
        badges={
          <>
            <ProvenanceBadge kind="proxy" />
            <ProvenanceBadge kind="real">Official statistics</ProvenanceBadge>
          </>
        }
      />

      <Section id="reference" title="Reference dataset">
        <div className="grid gap-4 xl:grid-cols-[1.3fr_1fr]">
          <div className="card-surface space-y-4 p-5">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <p className="font-mono text-xs text-muted-foreground">FRED · {s.id}</p>
                <h3 className="text-base font-semibold">{s.name}</h3>
              </div>
              <ProvenanceBadge kind="proxy" />
            </div>
            <dl className="grid grid-cols-1 gap-x-6 gap-y-2 text-sm sm:grid-cols-[auto_1fr]">
              <dt className="text-muted-foreground">Publisher</dt>
              <dd>{s.publisher}</dd>
              <dt className="text-muted-foreground">Coverage</dt>
              <dd>{s.coverage}</dd>
              <dt className="text-muted-foreground">Unit</dt>
              <dd>{s.unit}</dd>
              <dt className="text-muted-foreground">Analysis window</dt>
              <dd>
                {monthLabel(s.window.from)} – {monthLabel(s.window.to)} · {s.window.n_months} months
              </dd>
              <dt className="text-muted-foreground">Full history</dt>
              <dd>
                {monthLabel(s.full_history.from)} – {monthLabel(s.full_history.to)} · {s.full_history.rows} rows
              </dd>
              <dt className="text-muted-foreground">Retrieved</dt>
              <dd>{s.notebook_retrieval.replace("Source: ", "")}</dd>
              <dt className="text-muted-foreground">Source</dt>
              <dd>
                <a href={s.url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-primary hover:underline">
                  fred.stlouisfed.org/series/{s.id} <ExternalLink className="size-3" aria-hidden />
                </a>
              </dd>
            </dl>
            <p className="rounded-lg bg-muted/60 p-3 text-xs text-muted-foreground">{s.proxy_note} Because MAPE and WAPE are scale-free, the method carries over to a brand&apos;s unit sales.</p>
          </div>
          <div className="grid auto-rows-fr grid-cols-1 gap-4 sm:grid-cols-2">
            <KpiCard label="Months analysed" value={String(s.window.n_months)} sub="Jan 2012 – Sep 2026" />
            <KpiCard label="Mean index" value={s.stats.mean.toFixed(2)} sub={`std ${s.stats.std.toFixed(2)}`} />
            <KpiCard label="Minimum" value={s.stats.min.toFixed(2)} sub="index points" />
            <KpiCard label="Maximum" value={s.stats.max.toFixed(2)} sub="index points" />
          </div>
        </div>
      </Section>

      <Section
        id="quality"
        title="Data-quality report"
        description="Computed in the app from the series (in-app) and shown next to the notebook's own checks, so you can see they agree. No imputation was needed; the 2025 shock is a real market event and is kept."
      >
        <SimpleTable
          testId="quality-table"
          caption="Data-quality checks: in-app vs notebook"
          rows={checks}
          columns={[
            { key: "c", header: "Check", cell: (r) => r.check },
            { key: "a", header: "In-app (TypeScript)", numeric: true, cell: (r) => r.app },
            { key: "n", header: "Notebook (Python)", numeric: true, cell: (r) => r.notebook },
            { key: "ok", header: "Agree", cell: (r) => (r.app === r.notebook ? "✓ yes" : "no") },
          ]}
        />
      </Section>

      <Section
        id="upload"
        title="Upload your own monthly data"
        description="Map the columns, check the validation report and load the monthly series into this browser session. It then appears in the Forecasting Lab and can be analysed by the Copilot."
      >
        <UploadWorkspace />
      </Section>
    </div>
  );
}
