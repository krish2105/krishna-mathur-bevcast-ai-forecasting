"use client";

import { styleFor } from "@/lib/series-style";
import { cn } from "@/lib/utils";

export function LineSwatch({ name, color, dash, width }: { name?: string; color?: string; dash?: string; width?: number }) {
  const s = name ? styleFor(name) : { color: color ?? "currentColor", dash, width: width ?? 2 };
  return (
    <svg width="22" height="10" viewBox="0 0 22 10" aria-hidden className="shrink-0">
      <line
        x1="1"
        y1="5"
        x2="21"
        y2="5"
        stroke={color ?? s.color}
        strokeWidth={Math.max(2, s.width)}
        strokeDasharray={dash ?? s.dash}
        strokeLinecap="round"
      />
    </svg>
  );
}

export function BandSwatch({ color }: { color: string }) {
  return <span aria-hidden className="inline-block h-2.5 w-5 shrink-0 rounded-sm" style={{ background: color, opacity: 0.25 }} />;
}

/** Clickable legend: each entry toggles its series (aria-pressed). */
export function SeriesLegend({
  items,
  hidden,
  onToggle,
  extra,
}: {
  items: { key: string; name: string; style?: string; color?: string }[];
  hidden: Set<string>;
  onToggle?: (key: string) => void;
  extra?: React.ReactNode;
}) {
  return (
    <div className="flex flex-wrap items-center gap-x-1 gap-y-1 px-2 pb-1" role="group" aria-label="Chart legend: toggle series">
      {items.map((it) => {
        const off = hidden.has(it.key);
        return (
          <button
            key={it.key}
            type="button"
            onClick={() => onToggle?.(it.key)}
            aria-pressed={!off}
            disabled={!onToggle}
            className={cn(
              "inline-flex items-center gap-1.5 rounded-md px-1.5 py-1 text-xs transition-colors hover:bg-muted disabled:cursor-default disabled:hover:bg-transparent",
              off ? "text-muted-foreground line-through opacity-60" : "text-foreground",
            )}
          >
            <LineSwatch name={it.style ?? it.name} color={it.color} />
            {it.name}
          </button>
        );
      })}
      {extra}
    </div>
  );
}
