/** Month keys are "YYYY-MM" strings; all arithmetic is done on a month counter, never on Date objects. */

const MONTH_RE = /^(\d{4})-(0[1-9]|1[0-2])$/;
export const MONTH_ABBR = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"] as const;

export function isMonthKey(s: string): boolean {
  return MONTH_RE.test(s);
}

export function toIndex(month: string): number {
  const m = MONTH_RE.exec(month);
  if (!m) throw new Error(`Invalid month key "${month}" (expected YYYY-MM)`);
  return Number(m[1]) * 12 + (Number(m[2]) - 1);
}

export function fromIndex(idx: number): string {
  const y = Math.floor(idx / 12);
  const mo = idx - y * 12 + 1;
  return `${y}-${String(mo).padStart(2, "0")}`;
}

export function addMonths(month: string, n: number): string {
  return fromIndex(toIndex(month) + n);
}

/** Calendar month 1..12 */
export function monthOfYear(month: string): number {
  return (toIndex(month) % 12) + 1;
}

/** The `h` months after `last`, derived from the data (never hard-coded). */
export function nextMonths(last: string, h: number): string[] {
  return Array.from({ length: h }, (_, i) => addMonths(last, i + 1));
}

export function monthsBetween(a: string, b: string): number {
  return toIndex(b) - toIndex(a);
}

/** "2026-10" -> "Oct 2026" */
export function formatMonth(month: string): string {
  const idx = toIndex(month);
  return `${MONTH_ABBR[idx % 12]} ${Math.floor(idx / 12)}`;
}
