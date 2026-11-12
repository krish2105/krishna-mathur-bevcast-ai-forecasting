import { cn } from "@/lib/utils";

export interface Column<T> {
  key: string;
  header: React.ReactNode;
  cell: (row: T) => React.ReactNode;
  numeric?: boolean;
  className?: string;
}

/**
 * Accessible table: numbers right-aligned and tabular, long tables scroll inside their own container,
 * optional row highlight (e.g. the selected model).
 */
export function SimpleTable<T>({
  columns,
  rows,
  caption,
  highlight,
  maxHeight,
  className,
  dense,
  testId,
}: {
  columns: Column<T>[];
  rows: T[];
  caption?: string;
  highlight?: (row: T) => boolean;
  maxHeight?: number;
  className?: string;
  dense?: boolean;
  testId?: string;
}) {
  return (
    <div
      data-testid={testId}
      className={cn("relative w-full overflow-auto rounded-lg border border-border", className)}
      style={maxHeight ? { maxHeight } : undefined}
      tabIndex={0}
      role="region"
      aria-label={caption ?? "Data table"}
    >
      <table className="w-full min-w-max border-collapse text-sm">
        {caption && <caption className="sr-only">{caption}</caption>}
        <thead className="sticky top-0 z-10 bg-muted">
          <tr>
            {columns.map((c) => (
              <th
                key={c.key}
                scope="col"
                className={cn(
                  "border-b border-border px-3 text-xs font-medium whitespace-nowrap text-muted-foreground",
                  dense ? "py-1.5" : "py-2",
                  c.numeric ? "text-right" : "text-left",
                  c.className,
                )}
              >
                {c.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={i} className={cn("border-b border-border last:border-0", highlight?.(r) && "bg-accent/60 font-medium")}>
              {columns.map((c) => (
                <td
                  key={c.key}
                  className={cn(
                    "px-3 whitespace-nowrap",
                    dense ? "py-1.5" : "py-2",
                    c.numeric && "text-right tabular-nums",
                    c.className,
                  )}
                >
                  {c.cell(r)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
