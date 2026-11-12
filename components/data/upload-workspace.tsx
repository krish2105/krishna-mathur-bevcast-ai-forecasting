"use client";

import Link from "next/link";
import * as React from "react";
import { CheckCircle2, FileUp, FlaskConical, Trash2, TriangleAlert, Upload } from "lucide-react";
import { toast } from "sonner";
import { ChartCard } from "@/components/charts/chart-card";
import { TimeSeriesChart } from "@/components/charts/time-series-chart";
import { ProvenanceBadge } from "@/components/common/provenance-badge";
import { SimpleTable } from "@/components/common/simple-table";
import { useUpload } from "@/components/data/upload-context";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  MAX_FILE_BYTES,
  buildMonthlySeries,
  guessMapping,
  parseCsv,
  type ColumnMapping,
  type ParsedCsv,
} from "@/lib/data/csv";
import { formatMonth } from "@/lib/forecasting/dates";

const SAMPLE = "/samples/sample_flavored_water_monthly.csv";
const NONE = "__none__";

function NativeSelect({
  id,
  label,
  value,
  onChange,
  options,
  optional,
  testId,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (v: string) => void;
  options: string[];
  optional?: boolean;
  testId?: string;
}) {
  return (
    <div className="space-y-1.5">
      <Label htmlFor={id} className="text-xs">
        {label}
      </Label>
      <select
        id={id}
        data-testid={testId}
        value={value || (optional ? NONE : "")}
        onChange={(e) => onChange(e.target.value === NONE ? "" : e.target.value)}
        className="h-9 w-full rounded-lg border border-input bg-card px-2.5 text-sm"
      >
        {optional ? <option value={NONE}>None</option> : <option value="">Choose a column…</option>}
        {options.map((o) => (
          <option key={o} value={o}>
            {o}
          </option>
        ))}
      </select>
    </div>
  );
}

export function UploadWorkspace() {
  const { upload, setUpload } = useUpload();
  const [fileName, setFileName] = React.useState<string>("");
  const [parsed, setParsed] = React.useState<ParsedCsv | null>(null);
  const [mapping, setMapping] = React.useState<Partial<ColumnMapping>>({});
  const [product, setProduct] = React.useState("");
  const [region, setRegion] = React.useState("");
  const [fillGaps, setFillGaps] = React.useState(false);
  const [fileError, setFileError] = React.useState<string | null>(null);
  const [dragging, setDragging] = React.useState(false);
  const inputRef = React.useRef<HTMLInputElement>(null);

  const loadText = (name: string, text: string) => {
    const p = parseCsv(text);
    setFileName(name);
    setParsed(p);
    setMapping(guessMapping(p.headers));
    setProduct("");
    setRegion("");
    setFileError(p.headers.length < 2 ? "The file needs a header row with at least two columns (a date and a value)." : null);
  };

  const onFile = async (file: File | undefined) => {
    if (!file) return;
    if (file.size > MAX_FILE_BYTES) {
      setFileError(`File is ${(file.size / 1e6).toFixed(1)} MB; the limit is ${MAX_FILE_BYTES / 1e6} MB.`);
      return;
    }
    if (!/\.(csv|txt)$/i.test(file.name)) {
      setFileError("Please choose a .csv file.");
      return;
    }
    loadText(file.name, await file.text());
  };

  const loadSample = async () => {
    try {
      const res = await fetch(SAMPLE);
      if (!res.ok) throw new Error(String(res.status));
      loadText("sample_flavored_water_monthly.csv", await res.text());
    } catch {
      setFileError("Could not load the sample file.");
    }
  };

  const result = React.useMemo(() => {
    if (!parsed || !mapping.date || !mapping.value) return null;
    return buildMonthlySeries(parsed.rows, mapping as ColumnMapping, {
      product: product || undefined,
      region: region || undefined,
      fillGaps,
    });
  }, [parsed, mapping, product, region, fillGaps]);

  const useThis = () => {
    if (!result?.series) return;
    const label = [product, region].filter(Boolean).join(" · ") || fileName;
    setUpload({
      fileName,
      label,
      months: result.series.months,
      values: result.series.values,
      uploadedAt: new Date().toISOString(),
      imputedMonths: result.report.imputedMonths,
      warnings: result.warnings,
      report: {
        rowsRead: result.report.rowsRead,
        rowsUsed: result.report.rowsUsed,
        monthsWithSeveralRows: result.report.monthsWithSeveralRows,
        negativeValues: result.report.negativeValues,
        missingMonths: result.report.missingMonths,
      },
    });
    toast.success(`Loaded ${result.series.values.length} months into this browser session.`);
  };

  const chartRows = result?.series
    ? result.series.months.map((m, i) => ({ month: m, "Your data": result.series!.values[i] }))
    : [];
  const imputed = new Set(result?.report.imputedMonths ?? []);

  return (
    <div className="space-y-6">
      {upload && (
        <div className="card-surface flex flex-col gap-3 border-violet-fg/40 p-4 sm:flex-row sm:items-center sm:justify-between md:p-5" data-testid="current-upload">
          <div className="space-y-1">
            <div className="flex flex-wrap items-center gap-2">
              <ProvenanceBadge kind="uploaded" />
              <span className="text-sm font-semibold">Your uploaded data (this browser session only)</span>
            </div>
            <p className="text-sm text-muted-foreground">
              {upload.label}: {upload.values.length} months, {formatMonth(upload.months[0])} – {formatMonth(upload.months.at(-1)!)}
              {upload.imputedMonths.length > 0 && ` · ${upload.imputedMonths.length} imputed`}. Stored only in this tab; never sent to the server except
              as monthly values when you ask the Copilot.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button asChild size="sm">
              <Link href="/forecasting?dataset=uploaded&tab=engine">Forecast it</Link>
            </Button>
            <Button asChild size="sm" variant="outline">
              <Link href="/copilot">Ask the Copilot</Link>
            </Button>
            <Button size="sm" variant="ghost" onClick={() => setUpload(null)} aria-label="Clear uploaded data">
              <Trash2 /> Clear
            </Button>
          </div>
        </div>
      )}

      <div
        className={`card-surface flex flex-col items-center gap-3 border-2 border-dashed p-6 text-center transition-colors md:p-8 ${dragging ? "border-primary bg-accent/50" : ""}`}
        onDragOver={(e) => {
          e.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragging(false);
          void onFile(e.dataTransfer.files?.[0]);
        }}
      >
        <span className="grid size-11 place-items-center rounded-full bg-accent text-accent-foreground">
          <FileUp className="size-5" aria-hidden />
        </span>
        <div className="space-y-1">
          <p className="text-sm font-semibold">Upload a monthly sales CSV</p>
          <p className="max-w-md text-xs text-muted-foreground">
            Needs a date column and a value column; optional product and region columns. Several rows per month are summed. Parsed in your
            browser; nothing is stored on the server. Max 5 MB, up to 240 months used.
          </p>
        </div>
        <div className="flex flex-wrap justify-center gap-2">
          <Button onClick={() => inputRef.current?.click()}>
            <Upload /> Choose CSV
          </Button>
          <Button variant="outline" onClick={loadSample} data-testid="load-sample">
            <FlaskConical /> Load sample file
          </Button>
        </div>
        <input
          ref={inputRef}
          type="file"
          accept=".csv,text/csv"
          className="sr-only"
          data-testid="csv-input"
          aria-label="Upload a CSV file"
          onChange={(e) => void onFile(e.target.files?.[0])}
        />
        <p className="text-[11px] text-muted-foreground">
          The sample file contains the last 36 real values of FRED IPN31211N (category proxy), not invented sales.
        </p>
        {fileError && (
          <p className="text-sm text-critical-fg" role="alert">
            {fileError}
          </p>
        )}
      </div>

      {parsed && parsed.headers.length >= 2 && (
        <div className="grid gap-4 xl:grid-cols-[360px_1fr]">
          <div className="card-surface space-y-4 p-4 md:p-5">
            <div>
              <h3 className="text-sm font-semibold">Column mapping</h3>
              <p className="text-xs text-muted-foreground">
                {fileName}: {parsed.rows.length} rows, {parsed.headers.length} columns.
              </p>
            </div>
            <NativeSelect id="map-date" label="Date column" value={mapping.date ?? ""} onChange={(v) => setMapping((m) => ({ ...m, date: v }))} options={parsed.headers} testId="map-date" />
            <NativeSelect id="map-value" label="Value column (sales/units)" value={mapping.value ?? ""} onChange={(v) => setMapping((m) => ({ ...m, value: v }))} options={parsed.headers} testId="map-value" />
            <NativeSelect id="map-product" label="Product column (optional)" value={mapping.product ?? ""} onChange={(v) => setMapping((m) => ({ ...m, product: v || undefined }))} options={parsed.headers} optional />
            <NativeSelect id="map-region" label="Region column (optional)" value={mapping.region ?? ""} onChange={(v) => setMapping((m) => ({ ...m, region: v || undefined }))} options={parsed.headers} optional />
            {result && result.report.products.length > 1 && (
              <NativeSelect id="flt-product" label="Filter product" value={product} onChange={setProduct} options={result.report.products} optional />
            )}
            {result && result.report.regions.length > 1 && (
              <NativeSelect id="flt-region" label="Filter region" value={region} onChange={setRegion} options={result.report.regions} optional />
            )}
            <div className="flex items-center gap-2">
              <Switch id="fill" checked={fillGaps} onCheckedChange={setFillGaps} />
              <Label htmlFor="fill" className="text-xs font-normal">
                Fill missing months by linear interpolation (marked as imputed)
              </Label>
            </div>
            {parsed.parseErrors.length > 0 && (
              <ul className="space-y-1 text-xs text-warning-fg">
                {parsed.parseErrors.map((e) => (
                  <li key={e}>⚠ {e}</li>
                ))}
              </ul>
            )}
          </div>

          <div className="min-w-0 space-y-4">
            {result && (result.errors.length > 0 || result.warnings.length > 0) && (
              <div className="space-y-2" data-testid="validation">
                {result.errors.map((e) => (
                  <div key={e} role="alert" className="flex items-start gap-2 rounded-lg border border-critical/40 bg-critical/10 px-3 py-2 text-sm text-critical-fg">
                    <TriangleAlert className="mt-0.5 size-4 shrink-0" aria-hidden /> {e}
                  </div>
                ))}
                {result.warnings.map((w) => (
                  <div key={w} className="flex items-start gap-2 rounded-lg border border-warning/40 bg-warning/10 px-3 py-2 text-sm text-warning-fg">
                    <TriangleAlert className="mt-0.5 size-4 shrink-0" aria-hidden /> {w}
                  </div>
                ))}
                {result.report.invalidDates.length + result.report.invalidValues.length > 0 && (
                  <p className="text-xs text-muted-foreground">
                    Skipped rows:{" "}
                    {[...result.report.invalidDates.map((d) => `row ${d.row} (date "${d.value}")`), ...result.report.invalidValues.map((d) => `row ${d.row} (value "${d.value}")`)]
                      .slice(0, 8)
                      .join(", ")}
                    {result.report.invalidDates.length + result.report.invalidValues.length > 8 ? ", …" : ""}
                  </p>
                )}
              </div>
            )}
            {result?.series ? (
              <>
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <p className="flex items-center gap-2 text-sm">
                    <CheckCircle2 className="size-4 text-success-fg" aria-hidden />
                    {result.series.values.length} months ready: {formatMonth(result.series.months[0])} – {formatMonth(result.series.months.at(-1)!)}
                  </p>
                  <Button onClick={useThis} data-testid="use-upload">
                    Use this data
                  </Button>
                </div>
                <ChartCard
                  title="Monthly aggregation preview"
                  description="Your values, summed per calendar month."
                  badges={<ProvenanceBadge kind="uploaded" />}
                  data={result.series.months.map((m, i) => ({ month: m, value: result.series!.values[i], imputed: imputed.has(m) ? "yes" : "" }))}
                  fileName="upload-monthly-preview"
                >
                  <TimeSeriesChart data={chartRows} yLabel="Value" height={240} series={[{ key: "Your data", name: "Your data", dots: true }]} legend={false} />
                </ChartCard>
                <SimpleTable
                  caption="Monthly aggregation preview"
                  rows={result.series.months.map((m, i) => ({ m, v: result.series!.values[i] }))}
                  maxHeight={260}
                  dense
                  testId="upload-preview"
                  columns={[
                    { key: "m", header: "Month", cell: (r) => formatMonth(r.m) },
                    { key: "v", header: "Value", numeric: true, cell: (r) => r.v.toLocaleString("en-US", { maximumFractionDigits: 4 }) },
                    { key: "i", header: "Imputed", cell: (r) => (imputed.has(r.m) ? "yes" : "") },
                  ]}
                />
              </>
            ) : (
              !result && (
                <p className="rounded-lg border border-border bg-muted/50 p-4 text-sm text-muted-foreground">
                  Choose the date and value columns to preview the monthly series.
                </p>
              )
            )}
          </div>
        </div>
      )}
    </div>
  );
}
