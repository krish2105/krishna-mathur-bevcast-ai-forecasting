"use client";

import { useReducedMotion } from "motion/react";
import {
  CartesianGrid,
  ComposedChart,
  Line,
  ReferenceDot,
  ResponsiveContainer,
  Scatter,
  Tooltip,
  XAxis,
  YAxis,
  type TooltipContentProps,
} from "recharts";
import { SeriesLegend } from "@/components/charts/series-legend";
import { monthShort } from "@/lib/format";

interface MonthRow {
  month: string;
  demand: number;
  temp: number;
}

/**
 * Demand vs temperature on two y-axes, as the brief requires. Each axis is labelled with its unit and the
 * two lines use different dash patterns, so the scales are never confused; the scatter beside it shows the
 * same relationship on a single scale.
 */
export function DemandTempDualAxis({ rows, peak }: { rows: MonthRow[]; peak: { month: string; demand: number } }) {
  const reduce = useReducedMotion();
  const tip = ({ active, payload, label }: TooltipContentProps) =>
    active && payload?.length ? (
      <div className="rounded-lg border border-border bg-popover px-3 py-2 text-xs shadow-lg">
        <div className="mb-1 font-semibold">{monthShort(String(label))} 2023</div>
        {payload.map((p) => (
          <div key={String(p.dataKey)} className="flex justify-between gap-4">
            <span className="flex items-center gap-1.5">
              <span className="size-2 rounded-full" style={{ background: p.dataKey === "demand" ? "var(--m-actual)" : "var(--m-temp)" }} />
              {p.dataKey === "demand" ? "Demand" : "Mean temperature"}
            </span>
            <span className="font-medium tabular-nums">{p.dataKey === "demand" ? `${p.value} units` : `${Number(p.value).toFixed(2)} °C`}</span>
          </div>
        ))}
      </div>
    ) : null;
  return (
    <div>
      <SeriesLegend
        items={[
          { key: "demand", name: "Air-cooler demand (units)", style: "Actual" },
          { key: "temp", name: "Mean temperature, Dubai (°C)", style: "Temperature" },
        ]}
        hidden={new Set()}
      />
      <div className="h-[300px] w-full">
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={rows} margin={{ top: 22, right: 4, bottom: 4, left: 4 }} accessibilityLayer>
            <CartesianGrid vertical={false} stroke="var(--chart-grid)" />
            <XAxis dataKey="month" tickFormatter={monthShort} tickLine={false} axisLine={false} tick={{ fontSize: 11, fill: "var(--muted-foreground)" }} />
            <YAxis
              yAxisId="d"
              tickLine={false}
              axisLine={false}
              width={52}
              domain={[60, 240]}
              tick={{ fontSize: 11, fill: "var(--muted-foreground)" }}
              label={{ value: "Demand (units)", angle: -90, position: "insideLeft", offset: 6, style: { fontSize: 11, fill: "var(--muted-foreground)", textAnchor: "middle" } }}
            />
            <YAxis
              yAxisId="t"
              orientation="right"
              tickLine={false}
              axisLine={false}
              width={48}
              domain={[15, 40]}
              tick={{ fontSize: 11, fill: "var(--muted-foreground)" }}
              label={{ value: "Temperature (°C)", angle: 90, position: "insideRight", offset: 6, style: { fontSize: 11, fill: "var(--muted-foreground)", textAnchor: "middle" } }}
            />
            <Tooltip content={tip} cursor={{ stroke: "var(--muted-foreground)", strokeDasharray: "3 3" }} />
            <Line yAxisId="d" dataKey="demand" stroke="var(--m-actual)" strokeWidth={2.5} dot={{ r: 3, fill: "var(--m-actual)", strokeWidth: 0 }} isAnimationActive={!reduce} />
            <Line yAxisId="t" dataKey="temp" stroke="var(--m-temp)" strokeWidth={2} strokeDasharray="6 3" dot={{ r: 3, fill: "var(--m-temp)", strokeWidth: 0 }} isAnimationActive={!reduce} />
            <ReferenceDot
              yAxisId="d"
              x={peak.month}
              y={peak.demand}
              r={4}
              fill="var(--card)"
              stroke="var(--m-actual)"
              strokeWidth={2}
              label={{ value: `Peak: ${peak.demand} units (${monthShort(peak.month)})`, position: "top", fontSize: 11, fill: "var(--foreground)" }}
            />
          </ComposedChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

/** Demand against temperature on one plane, with the least-squares line. */
export function DemandTempScatter({
  rows,
  slope,
  intercept,
}: {
  rows: MonthRow[];
  slope: number;
  intercept: number;
}) {
  const reduce = useReducedMotion();
  const xs = rows.map((r) => r.temp);
  const lo = Math.min(...xs);
  const hi = Math.max(...xs);
  const fit = [
    { temp: lo, fit: intercept + slope * lo },
    { temp: hi, fit: intercept + slope * hi },
  ];
  const pts = rows.map((r) => ({ temp: r.temp, demand: r.demand, label: monthShort(r.month) }));
  const tip = ({ active, payload }: TooltipContentProps) => {
    const p = payload?.[0]?.payload as { temp: number; demand?: number; label?: string } | undefined;
    return active && p?.demand !== undefined ? (
      <div className="rounded-lg border border-border bg-popover px-3 py-2 text-xs shadow-lg">
        <div className="font-semibold">{p.label} 2023</div>
        <div className="tabular-nums">
          {p.demand} units at {p.temp.toFixed(2)} °C
        </div>
      </div>
    ) : null;
  };
  return (
    <div className="h-[300px] w-full">
      <ResponsiveContainer width="100%" height="100%">
        <ComposedChart margin={{ top: 16, right: 16, bottom: 20, left: 4 }} accessibilityLayer>
          <CartesianGrid stroke="var(--chart-grid)" />
          <XAxis
            type="number"
            dataKey="temp"
            domain={[18, 37]}
            tickLine={false}
            axisLine={false}
            tick={{ fontSize: 11, fill: "var(--muted-foreground)" }}
            label={{ value: "Mean monthly temperature (°C)", position: "insideBottom", offset: -12, fontSize: 11, fill: "var(--muted-foreground)" }}
          />
          <YAxis
            type="number"
            dataKey="demand"
            domain={[60, 240]}
            tickLine={false}
            axisLine={false}
            width={52}
            tick={{ fontSize: 11, fill: "var(--muted-foreground)" }}
            label={{ value: "Demand (units)", angle: -90, position: "insideLeft", offset: 6, style: { fontSize: 11, fill: "var(--muted-foreground)", textAnchor: "middle" } }}
          />
          <Tooltip content={tip} />
          <Line data={fit} dataKey="fit" stroke="var(--m-weather)" strokeWidth={2} dot={false} isAnimationActive={!reduce} legendType="none" />
          <Scatter data={pts} fill="var(--m-actual)" isAnimationActive={!reduce} />
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
}
