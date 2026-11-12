import { MONTH_ABBR } from "@/lib/forecasting/dates";

/**
 * Year x month heatmap with a sequential single-hue scale (light -> dark teal). Values are also printed in
 * each cell, so colour is never the only signal. Scrolls inside its own container on narrow screens.
 */
export function YearMonthHeatmap({ rows }: { rows: { year: number; values: (number | null)[] }[] }) {
  const all = rows.flatMap((r) => r.values).filter((v): v is number => v !== null);
  const min = Math.min(...all);
  const max = Math.max(...all);
  const shade = (v: number) => {
    const t = (v - min) / (max - min || 1);
    return `color-mix(in oklab, var(--primary) ${Math.round(8 + t * 80)}%, var(--card))`;
  };
  return (
    <div className="space-y-3">
      <div className="overflow-x-auto rounded-lg" tabIndex={0} role="region" aria-label="Year by month heatmap of the production index">
        <table className="w-full min-w-[680px] border-separate border-spacing-[2px] text-[11px]">
          <caption className="sr-only">FRED IPN31211N index by year (rows) and month (columns)</caption>
          <thead>
            <tr>
              <th scope="col" className="w-12 text-left font-medium text-muted-foreground">
                Year
              </th>
              {MONTH_ABBR.map((m) => (
                <th key={m} scope="col" className="font-medium text-muted-foreground">
                  {m}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.year}>
                <th scope="row" className="pr-1 text-left font-medium text-muted-foreground">
                  {r.year}
                </th>
                {r.values.map((v, i) => {
                  const t = v === null ? 0 : (v - min) / (max - min || 1);
                  return (
                    <td
                      key={i}
                      title={v === null ? `${MONTH_ABBR[i]} ${r.year}: no data` : `${MONTH_ABBR[i]} ${r.year}: ${v.toFixed(2)}`}
                      className="h-7 rounded-[4px] text-center tabular-nums"
                      style={{
                        background: v === null ? "transparent" : shade(v),
                        color: t > 0.55 ? "var(--primary-foreground)" : "var(--foreground)",
                        border: v === null ? "1px dashed var(--border)" : undefined,
                      }}
                    >
                      {v === null ? "" : v.toFixed(0)}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="flex items-center gap-2 text-xs text-muted-foreground">
        <span>{min.toFixed(1)}</span>
        <span
          aria-hidden
          className="h-2 w-40 rounded-full"
          style={{ background: "linear-gradient(90deg, color-mix(in oklab, var(--primary) 8%, var(--card)), color-mix(in oklab, var(--primary) 88%, var(--card)))" }}
        />
        <span>{max.toFixed(1)}</span>
        <span>index (2017 = 100); darker = higher production</span>
      </div>
    </div>
  );
}
