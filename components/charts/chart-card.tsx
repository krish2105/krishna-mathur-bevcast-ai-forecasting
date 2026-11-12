"use client";

import * as React from "react";
import { Download, ImageDown, Table2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { SimpleTable, type Column } from "@/components/common/simple-table";
import { toCsv } from "@/lib/format";
import { cn } from "@/lib/utils";

export type DataRow = Record<string, string | number | null | undefined>;

function download(name: string, href: string) {
  const a = document.createElement("a");
  a.href = href;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
}

/**
 * Frame for every chart: title with units, provenance badges, PNG / CSV export, and a "View data"
 * disclosure holding a real <table> for screen-reader users.
 */
export function ChartCard({
  title,
  description,
  badges,
  children,
  data,
  columns,
  fileName,
  footer,
  className,
  testId,
  toolbar,
}: {
  title: string;
  description?: React.ReactNode;
  badges?: React.ReactNode;
  children: React.ReactNode;
  data: DataRow[];
  columns?: { key: string; label: string; numeric?: boolean; format?: (v: DataRow[string]) => string }[];
  fileName: string;
  footer?: React.ReactNode;
  className?: string;
  testId?: string;
  toolbar?: React.ReactNode;
}) {
  const plotRef = React.useRef<HTMLDivElement>(null);
  const cols =
    columns ??
    Object.keys(data[0] ?? {}).map((k) => ({ key: k, label: k, numeric: typeof data[0]?.[k] === "number", format: undefined }));

  const exportPng = async () => {
    if (!plotRef.current) return;
    try {
      const { toPng } = await import("html-to-image");
      const bg = getComputedStyle(plotRef.current.closest("[data-chart-card]") ?? document.body).backgroundColor;
      const url = await toPng(plotRef.current, { backgroundColor: bg, pixelRatio: 2, cacheBust: true });
      download(`${fileName}.png`, url);
    } catch {
      toast.error("PNG export failed in this browser. The CSV export still works.");
    }
  };

  const exportCsv = () => {
    const rows = data.map((r) => Object.fromEntries(cols.map((c) => [c.label, r[c.key] ?? ""])));
    const blob = new Blob([toCsv(rows)], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    download(`${fileName}.csv`, url);
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };

  const tableColumns: Column<DataRow>[] = cols.map((c) => ({
    key: c.key,
    header: c.label,
    numeric: c.numeric,
    cell: (r) => {
      const v = r[c.key];
      if (c.format) return c.format(v);
      if (typeof v === "number") return Number.isInteger(v) ? v : v.toFixed(2);
      return v ?? "";
    },
  }));

  return (
    <div data-chart-card data-testid={testId} className={cn("card-surface flex min-w-0 flex-col", className)}>
      <div className="flex flex-col gap-3 p-4 pb-2 sm:flex-row sm:items-start sm:justify-between md:p-5 md:pb-2">
        <div className="min-w-0 space-y-1">
          <h3 className="text-[15px] leading-snug font-semibold">{title}</h3>
          {description && <div className="text-xs text-muted-foreground">{description}</div>}
          {badges && <div className="flex flex-wrap gap-1.5 pt-1">{badges}</div>}
        </div>
        <div className="no-print flex shrink-0 items-center gap-1" data-print-hide>
          {toolbar}
          <Button variant="ghost" size="icon-sm" onClick={exportPng} aria-label={`Export ${title} as PNG`} title="Export PNG">
            <ImageDown className="size-4" />
          </Button>
          <Button variant="ghost" size="icon-sm" onClick={exportCsv} aria-label={`Export ${title} data as CSV`} title="Export CSV">
            <Download className="size-4" />
          </Button>
        </div>
      </div>
      <div ref={plotRef} className="min-w-0 px-2 pb-2 md:px-3">
        {children}
      </div>
      {footer && <div className="px-4 pb-3 text-xs text-muted-foreground md:px-5">{footer}</div>}
      <details className="group border-t border-border px-4 py-2 md:px-5" data-print-hide>
        <summary className="flex cursor-pointer list-none items-center gap-1.5 py-1 text-xs font-medium text-muted-foreground hover:text-foreground">
          <Table2 className="size-3.5" aria-hidden /> View data
          <span>({data.length} rows)</span>
        </summary>
        <div className="pt-2 pb-2">
          <SimpleTable columns={tableColumns} rows={data} caption={`${title}: data`} maxHeight={280} dense />
        </div>
      </details>
    </div>
  );
}
