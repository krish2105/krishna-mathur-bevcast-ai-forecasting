"use client";

import * as React from "react";
import { useReducedMotion } from "motion/react";
import {
  Area,
  CartesianGrid,
  ComposedChart,
  Line,
  ReferenceArea,
  ReferenceDot,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
  type TooltipContentProps,
} from "recharts";
import { BandSwatch, SeriesLegend } from "@/components/charts/series-legend";
import { monthLabel, monthTick } from "@/lib/format";
import { styleFor } from "@/lib/series-style";

export interface SeriesDef {
  key: string;
  name: string;
  /** name used to look up colour/dash in SERIES_STYLE (defaults to `name`) */
  style?: string;
  emphasize?: boolean;
  dots?: boolean;
  defaultHidden?: boolean;
}

export interface BandDef {
  key: string;
  name: string;
  color: string;
  opacity: number;
}

export type ChartRow = Record<string, string | number | null | [number, number] | undefined>;

interface Props {
  data: ChartRow[];
  series: SeriesDef[];
  bands?: BandDef[];
  dividers?: { x: string; label: string }[];
  regions?: { x1: string; x2: string; label?: string }[];
  peaks?: { x: string; y: number; label: string }[];
  yLabel: string;
  height?: number;
  yDomain?: [number | "auto" | "dataMin" | "dataMax", number | "auto" | "dataMin" | "dataMax"];
  valueDigits?: number;
  xKey?: string;
  xFormat?: (x: string) => string;
  tooltipXFormat?: (x: string) => string;
  hiddenKeys?: string[];
  onHiddenChange?: (hidden: string[]) => void;
  legend?: boolean;
}

function fmt(v: number, d: number) {
  return v.toLocaleString("en-US", { minimumFractionDigits: d, maximumFractionDigits: d });
}

export function TimeSeriesChart({
  data,
  series,
  bands = [],
  dividers = [],
  regions = [],
  peaks = [],
  yLabel,
  height = 320,
  yDomain = ["auto", "auto"],
  valueDigits = 2,
  xKey = "month",
  xFormat = monthTick,
  tooltipXFormat = monthLabel,
  hiddenKeys,
  onHiddenChange,
  legend = true,
}: Props) {
  const reduce = useReducedMotion();
  const [localHidden, setLocalHidden] = React.useState<Set<string>>(
    () => new Set(series.filter((s) => s.defaultHidden).map((s) => s.key)),
  );
  const hidden = hiddenKeys ? new Set(hiddenKeys) : localHidden;
  const toggle = (k: string) => {
    const next = new Set(hidden);
    if (next.has(k)) next.delete(k);
    else next.add(k);
    if (onHiddenChange) onHiddenChange([...next]);
    else setLocalHidden(next);
  };

  const renderTooltip = (props: TooltipContentProps) => {
    const { active, payload, label } = props;
    if (!active || !payload?.length) return null;
    const row = payload[0]?.payload as ChartRow | undefined;
    return (
      <div className="min-w-[180px] rounded-lg border border-border bg-popover px-3 py-2 text-xs shadow-lg">
        <div className="mb-1.5 font-semibold">{tooltipXFormat(String(label))}</div>
        <div className="space-y-1">
          {series
            .filter((s) => !hidden.has(s.key) && typeof row?.[s.key] === "number")
            .map((s) => {
              const st = styleFor(s.style ?? s.name);
              return (
                <div key={s.key} className="flex items-center justify-between gap-4">
                  <span className="flex items-center gap-1.5">
                    <span className="size-2 rounded-full" style={{ background: st.color }} />
                    {s.name}
                  </span>
                  <span className="font-medium tabular-nums">{fmt(row![s.key] as number, valueDigits)}</span>
                </div>
              );
            })}
          {bands
            .filter((b) => Array.isArray(row?.[b.key]))
            .map((b) => {
              const [lo, hi] = row![b.key] as [number, number];
              return (
                <div key={b.key} className="flex items-center justify-between gap-4 text-muted-foreground">
                  <span className="flex items-center gap-1.5">
                    <BandSwatch color={b.color} />
                    {b.name}
                  </span>
                  <span className="tabular-nums">
                    {fmt(lo, valueDigits)} – {fmt(hi, valueDigits)}
                  </span>
                </div>
              );
            })}
        </div>
      </div>
    );
  };

  return (
    <div className="w-full">
      {legend && (
        <SeriesLegend
          items={series.map((s) => ({ key: s.key, name: s.name, style: s.style }))}
          hidden={hidden}
          onToggle={toggle}
          extra={bands.map((b) => (
            <span key={b.key} className="inline-flex items-center gap-1.5 px-1.5 py-1 text-xs text-muted-foreground">
              <BandSwatch color={b.color} /> {b.name}
            </span>
          ))}
        />
      )}
      <div style={{ height }} className="w-full">
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={data} margin={{ top: 16, right: 12, bottom: 4, left: 4 }} accessibilityLayer>
            <CartesianGrid vertical={false} stroke="var(--chart-grid)" />
            <XAxis
              dataKey={xKey}
              tickFormatter={xFormat}
              tickLine={false}
              axisLine={false}
              tickMargin={8}
              minTickGap={18}
              tick={{ fontSize: 11, fill: "var(--muted-foreground)" }}
            />
            <YAxis
              domain={yDomain}
              tickLine={false}
              axisLine={false}
              width={52}
              tick={{ fontSize: 11, fill: "var(--muted-foreground)" }}
              tickFormatter={(v: number) => fmt(v, v >= 1000 ? 0 : valueDigits > 1 ? 1 : valueDigits)}
              label={{
                value: yLabel,
                angle: -90,
                position: "insideLeft",
                offset: 6,
                style: { fontSize: 11, fill: "var(--muted-foreground)", textAnchor: "middle" },
              }}
            />
            <Tooltip content={renderTooltip} cursor={{ stroke: "var(--muted-foreground)", strokeDasharray: "3 3" }} />
            {regions.map((r) => (
              <ReferenceArea
                key={`${r.x1}-${r.x2}`}
                x1={r.x1}
                x2={r.x2}
                fill="var(--muted-foreground)"
                fillOpacity={0.07}
                stroke="none"
                label={r.label ? { value: r.label, position: "insideTopRight", fontSize: 11, fill: "var(--muted-foreground)" } : undefined}
              />
            ))}
            {bands.map((b) => (
              <Area
                key={b.key}
                dataKey={b.key}
                name={b.name}
                stroke="none"
                fill={b.color}
                fillOpacity={b.opacity}
                isAnimationActive={!reduce}
                connectNulls={false}
                activeDot={false}
              />
            ))}
            {dividers.map((d) => (
              <ReferenceLine
                key={d.x}
                x={d.x}
                stroke="var(--muted-foreground)"
                strokeDasharray="4 4"
                label={{ value: d.label, position: "insideTopLeft", fontSize: 11, fill: "var(--muted-foreground)" }}
              />
            ))}
            {series.map((s) => {
              const st = styleFor(s.style ?? s.name);
              return (
                <Line
                  key={s.key}
                  type="linear"
                  dataKey={s.key}
                  name={s.name}
                  hide={hidden.has(s.key)}
                  stroke={st.color}
                  strokeWidth={s.emphasize ? st.width + 1 : st.width}
                  strokeDasharray={st.dash}
                  strokeLinecap="round"
                  dot={s.dots ? { r: 2.5, strokeWidth: 0, fill: st.color } : false}
                  activeDot={{ r: 4, strokeWidth: 2, stroke: "var(--card)" }}
                  connectNulls={false}
                  isAnimationActive={!reduce}
                  animationDuration={600}
                />
              );
            })}
            {peaks.map((p) => (
              <ReferenceDot
                key={p.x}
                x={p.x}
                y={p.y}
                r={3.5}
                fill="var(--card)"
                stroke="var(--m-actual)"
                strokeWidth={2}
                label={{ value: p.label, position: "top", fontSize: 11, fill: "var(--foreground)" }}
              />
            ))}
          </ComposedChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
