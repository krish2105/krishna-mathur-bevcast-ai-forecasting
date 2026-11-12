import { formatMonth } from "@/lib/forecasting/dates";

export function pct(v: number | null | undefined, digits = 2): string {
  if (v === null || v === undefined || !Number.isFinite(v)) return "n/a";
  return `${v.toFixed(digits)}%`;
}

export function num(v: number | null | undefined, digits = 2): string {
  if (v === null || v === undefined || !Number.isFinite(v)) return "n/a";
  return v.toLocaleString("en-US", { minimumFractionDigits: digits, maximumFractionDigits: digits });
}

export function signed(v: number, digits = 2, unit = ""): string {
  const s = v > 0 ? "+" : v < 0 ? "−" : "±";
  return `${s}${Math.abs(v).toFixed(digits)}${unit}`;
}

/** "2026-10" -> "Oct 2026" */
export const monthLabel = formatMonth;

/** "2026-10" -> "Oct 26" (axis ticks) */
export function monthTick(m: string): string {
  const [y, mo] = m.split("-");
  const abbr = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"][Number(mo) - 1];
  return `${abbr} ${y.slice(2)}`;
}

export function monthShort(m: string): string {
  return ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"][Number(m.split("-")[1]) - 1];
}

export function relativeImprovement(model: number, baseline: number): number {
  return (1 - model / baseline) * 100;
}

export function toCsv(rows: Record<string, string | number | null | undefined>[]): string {
  if (rows.length === 0) return "";
  const headers = Object.keys(rows[0]);
  const esc = (v: unknown) => {
    const s = v === null || v === undefined ? "" : String(v);
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  return [headers.join(","), ...rows.map((r) => headers.map((h) => esc(r[h])).join(","))].join("\n");
}
