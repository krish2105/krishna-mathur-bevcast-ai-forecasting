/**
 * CSV upload pipeline. Runs in the browser only: nothing is sent to or stored on the server.
 * parse -> map columns -> validate -> aggregate to calendar months -> (optional) fill gaps -> cap length.
 */
import Papa from "papaparse";
import { addMonths, fromIndex, toIndex } from "@/lib/forecasting/dates";

export const MAX_POINTS = 240;
export const MAX_FILE_BYTES = 5 * 1024 * 1024;

export interface ParsedCsv {
  headers: string[];
  rows: Record<string, string>[];
  parseErrors: string[];
}

export function parseCsv(text: string): ParsedCsv {
  const res = Papa.parse<Record<string, string>>(text.replace(/^﻿/, ""), {
    header: true,
    skipEmptyLines: "greedy",
    transformHeader: (h) => h.trim(),
  });
  const headers = (res.meta.fields ?? []).filter((h) => h.length > 0);
  const parseErrors = res.errors.slice(0, 10).map((e) => `Row ${(e.row ?? 0) + 2}: ${e.message}`);
  return { headers, rows: res.data, parseErrors };
}

export interface ColumnMapping {
  date: string;
  value: string;
  product?: string;
  region?: string;
}

export function guessMapping(headers: string[]): Partial<ColumnMapping> {
  const find = (re: RegExp) => headers.find((h) => re.test(h.toLowerCase()));
  return {
    date: find(/^(date|month|period|time|observation_date|ds)$/) ?? find(/date|month|period|time/),
    value: find(/^(sales|units|value|qty|quantity|demand|volume|y)$/) ?? find(/sales|unit|value|qty|quant|demand|volume|revenue/),
    product: find(/product|sku|item|brand|flavou?r/),
    region: find(/region|market|store|area|country|city/),
  };
}

const MONTHS: Record<string, number> = {
  jan: 1, feb: 2, mar: 3, apr: 4, may: 5, jun: 6, jul: 7, aug: 8, sep: 9, sept: 9, oct: 10, nov: 11, dec: 12,
};

function ym(y: number, m: number): string | null {
  if (!Number.isInteger(y) || !Number.isInteger(m) || y < 1900 || y > 2200 || m < 1 || m > 12) return null;
  return `${y}-${String(m).padStart(2, "0")}`;
}

/**
 * Converts a date cell to "YYYY-MM". Accepted: 2024-03, 2024-03-15, 2024/03/15, 2024-03-15T..., 03/2024,
 * Mar 2024, March-2024, 2024 Mar, and dd/mm/yyyy or mm/dd/yyyy (`dayFirst` decides the ambiguous case).
 */
export function toMonthKey(raw: string, dayFirst = true): string | null {
  const s = raw.trim();
  if (!s) return null;
  let m = /^(\d{4})[-/.](\d{1,2})(?:[-/.](\d{1,2}))?(?:[T\s].*)?$/.exec(s);
  if (m) return ym(+m[1], +m[2]);
  m = /^(\d{1,2})[-/.](\d{4})$/.exec(s);
  if (m) return ym(+m[2], +m[1]);
  m = /^(\d{1,2})[-/.](\d{1,2})[-/.](\d{4})$/.exec(s);
  if (m) return dayFirst ? ym(+m[3], +m[2]) : ym(+m[3], +m[1]);
  m = /^([A-Za-z]{3,9})[\s\-/,.]+(\d{4})$/.exec(s);
  if (m) return ym(+m[2], MONTHS[m[1].slice(0, 4).toLowerCase()] ?? MONTHS[m[1].slice(0, 3).toLowerCase()]);
  m = /^(\d{4})[\s\-/,.]+([A-Za-z]{3,9})$/.exec(s);
  if (m) return ym(+m[1], MONTHS[m[2].slice(0, 3).toLowerCase()]);
  return null;
}

/** Decide dd/mm vs mm/dd from the data: any first part > 12 means day-first. */
export function detectDayFirst(values: string[]): boolean {
  let firstOver12 = false;
  let secondOver12 = false;
  for (const v of values) {
    const m = /^(\d{1,2})[-/.](\d{1,2})[-/.]\d{4}$/.exec(v.trim());
    if (!m) continue;
    if (+m[1] > 12) firstOver12 = true;
    if (+m[2] > 12) secondOver12 = true;
  }
  return firstOver12 || !secondOver12;
}

export function toNumber(raw: string): number | null {
  const s = raw.trim().replace(/[\s,]/g, "").replace(/^\$|^AED|^USD/i, "");
  if (s === "") return null;
  const v = Number(s);
  return Number.isFinite(v) ? v : null;
}

export interface QualityReport {
  rowsRead: number;
  rowsUsed: number;
  invalidDates: { row: number; value: string }[];
  invalidValues: { row: number; value: string }[];
  negativeValues: number;
  monthsWithSeveralRows: number;
  missingMonths: string[];
  imputedMonths: string[];
  truncatedTo?: number;
  products: string[];
  regions: string[];
}

export interface MonthlySeries {
  months: string[];
  values: number[];
}

export interface BuildResult {
  series: MonthlySeries | null;
  report: QualityReport;
  errors: string[];
  warnings: string[];
}

export interface BuildOptions {
  product?: string;
  region?: string;
  fillGaps?: boolean;
  maxPoints?: number;
}

export function buildMonthlySeries(rows: Record<string, string>[], mapping: ColumnMapping, opts: BuildOptions = {}): BuildResult {
  const errors: string[] = [];
  const warnings: string[] = [];
  const report: QualityReport = {
    rowsRead: rows.length,
    rowsUsed: 0,
    invalidDates: [],
    invalidValues: [],
    negativeValues: 0,
    monthsWithSeveralRows: 0,
    missingMonths: [],
    imputedMonths: [],
    products: mapping.product ? [...new Set(rows.map((r) => (r[mapping.product!] ?? "").trim()).filter(Boolean))].sort() : [],
    regions: mapping.region ? [...new Set(rows.map((r) => (r[mapping.region!] ?? "").trim()).filter(Boolean))].sort() : [],
  };
  if (!mapping.date || !mapping.value) {
    return { series: null, report, errors: ["Choose a date column and a value column."], warnings };
  }
  if (mapping.date === mapping.value) {
    return { series: null, report, errors: ["Date and value must be different columns."], warnings };
  }
  const dayFirst = detectDayFirst(rows.map((r) => r[mapping.date] ?? ""));
  const sums = new Map<string, number>();
  const counts = new Map<string, number>();
  rows.forEach((r, i) => {
    if (opts.product && mapping.product && (r[mapping.product] ?? "").trim() !== opts.product) return;
    if (opts.region && mapping.region && (r[mapping.region] ?? "").trim() !== opts.region) return;
    const month = toMonthKey(r[mapping.date] ?? "", dayFirst);
    if (!month) {
      report.invalidDates.push({ row: i + 2, value: String(r[mapping.date] ?? "") });
      return;
    }
    const v = toNumber(r[mapping.value] ?? "");
    if (v === null) {
      report.invalidValues.push({ row: i + 2, value: String(r[mapping.value] ?? "") });
      return;
    }
    if (v < 0) report.negativeValues++;
    sums.set(month, (sums.get(month) ?? 0) + v);
    counts.set(month, (counts.get(month) ?? 0) + 1);
    report.rowsUsed++;
  });
  report.monthsWithSeveralRows = [...counts.values()].filter((c) => c > 1).length;
  if (report.invalidDates.length) warnings.push(`${report.invalidDates.length} row(s) skipped: date not recognised.`);
  if (report.invalidValues.length) warnings.push(`${report.invalidValues.length} row(s) skipped: value is not a number.`);
  if (report.negativeValues) warnings.push(`${report.negativeValues} negative value(s) found (returns?). They are kept.`);
  if (report.monthsWithSeveralRows) {
    warnings.push(`${report.monthsWithSeveralRows} month(s) had several rows; values were summed per month.`);
  }
  if (sums.size === 0) {
    errors.push("No usable rows. Check the column mapping and the date format.");
    return { series: null, report, errors, warnings };
  }
  const keys = [...sums.keys()].sort();
  const start = toIndex(keys[0]);
  const end = toIndex(keys.at(-1)!);
  const months: string[] = [];
  const values: (number | null)[] = [];
  for (let k = start; k <= end; k++) {
    const m = fromIndex(k);
    months.push(m);
    values.push(sums.has(m) ? sums.get(m)! : null);
    if (!sums.has(m)) report.missingMonths.push(m);
  }
  if (report.missingMonths.length) {
    if (!opts.fillGaps) {
      errors.push(
        `${report.missingMonths.length} month(s) missing between ${keys[0]} and ${keys.at(-1)} ` +
          `(${report.missingMonths.slice(0, 6).join(", ")}${report.missingMonths.length > 6 ? ", …" : ""}). ` +
          "Fill them in the file, or turn on linear gap-filling (filled months are marked as imputed).",
      );
      return { series: null, report, errors, warnings };
    }
    for (let i = 0; i < values.length; i++) {
      if (values[i] !== null) continue;
      let a = i - 1;
      while (values[a] === null) a--;
      let b = i + 1;
      while (values[b] === null) b++;
      const prev = values[a]!;
      const next = values[b]!;
      values[i] = prev + ((next - prev) * (i - a)) / (b - a);
      report.imputedMonths.push(months[i]);
    }
    warnings.push(`${report.imputedMonths.length} missing month(s) filled by linear interpolation (imputed).`);
  }
  let outMonths = months;
  let outValues = values as number[];
  const cap = opts.maxPoints ?? MAX_POINTS;
  if (outValues.length > cap) {
    outMonths = outMonths.slice(-cap);
    outValues = outValues.slice(-cap);
    report.truncatedTo = cap;
    warnings.push(`Series longer than ${cap} months: the most recent ${cap} months are used.`);
  }
  if (outValues.length < 6) errors.push(`Only ${outValues.length} month(s) after aggregation; at least 6 are needed.`);
  return { series: errors.length ? null : { months: outMonths, values: outValues }, report, errors, warnings };
}

/** Sanity helper used by tests: the months are consecutive with no gaps. */
export function isConsecutive(months: readonly string[]): boolean {
  return months.every((m, i) => i === 0 || addMonths(months[i - 1], 1) === m);
}
