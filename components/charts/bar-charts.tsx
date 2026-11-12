"use client";

import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  LabelList,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
  type TooltipContentProps,
} from "recharts";
import { styleFor } from "@/lib/series-style";

type Row = Record<string, string | number | null>;

function TipBox({ title, rows }: { title: string; rows: { label: string; value: string; color?: string }[] }) {
  return (
    <div className="min-w-[160px] rounded-lg border border-border bg-popover px-3 py-2 text-xs shadow-lg">
      <div className="mb-1 font-semibold">{title}</div>
      {rows.map((r) => (
        <div key={r.label} className="flex items-center justify-between gap-4">
          <span className="flex items-center gap-1.5">
            {r.color && <span className="size-2 rounded-sm" style={{ background: r.color }} />}
            {r.label}
          </span>
          <span className="font-medium tabular-nums">{r.value}</span>
        </div>
      ))}
    </div>
  );
}

/**
 * Horizontal grouped bars per model (e.g. MAPE light, WAPE solid), coloured by the model's fixed colour.
 * Values are direct-labelled at the bar end; identity is also given by the y-axis label.
 */
export function ModelBars({
  data,
  bars,
  nameKey = "model",
  xLabel,
  unit = "%",
  digits = 2,
  labelWidth = 150,
  barSize = 12,
}: {
  data: Row[];
  /** `color` fixes one colour for the whole bar series; otherwise each row takes its model colour. */
  bars: { key: string; label: string; opacity: number; color?: string }[];
  nameKey?: string;
  xLabel: string;
  unit?: string;
  digits?: number;
  labelWidth?: number;
  barSize?: number;
}) {
  const colorOf = (bar: { color?: string }, row: string) => bar.color ?? styleFor(row).color;
  const height = Math.max(160, data.length * (bars.length * (barSize + 4) + 18) + 48);
  const tip = ({ active, payload, label }: TooltipContentProps) =>
    active && payload?.length ? (
      <TipBox
        title={String(label)}
        rows={payload.map((p, i) => ({
          label: String(p.name),
          value: `${Number(p.value).toFixed(digits)}${unit}`,
          color: colorOf(bars[i] ?? {}, String(label)),
        }))}
      />
    ) : null;
  return (
    <div style={{ height }} className="w-full">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} layout="vertical" margin={{ top: 4, right: 48, bottom: 20, left: 4 }} barGap={2} accessibilityLayer>
          <CartesianGrid horizontal={false} stroke="var(--chart-grid)" />
          <XAxis
            type="number"
            tickLine={false}
            axisLine={false}
            tick={{ fontSize: 11, fill: "var(--muted-foreground)" }}
            label={{ value: xLabel, position: "insideBottom", offset: -12, fontSize: 11, fill: "var(--muted-foreground)" }}
          />
          <YAxis
            type="category"
            dataKey={nameKey}
            width={labelWidth}
            tickLine={false}
            axisLine={false}
            tick={{ fontSize: 11, fill: "var(--foreground)" }}
          />
          <Tooltip content={tip} cursor={{ fill: "var(--muted)", opacity: 0.6 }} />
          {bars.map((b) => (
            <Bar key={b.key} dataKey={b.key} name={b.label} barSize={barSize} radius={[0, 4, 4, 0]} isAnimationActive={false}>
              {data.map((r) => (
                <Cell key={String(r[nameKey])} fill={colorOf(b, String(r[nameKey]))} fillOpacity={b.opacity} />
              ))}
              <LabelList
                dataKey={b.key}
                position="right"
                formatter={(v: unknown) => (typeof v === "number" ? `${v.toFixed(digits)}${unit}` : "")}
                style={{ fontSize: 10.5, fill: "var(--foreground)" }}
              />
            </Bar>
          ))}
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

/** Vertical bars around a zero line, coloured by sign (diverging). */
export function SignedColumns({
  data,
  valueKey,
  nameKey,
  yLabel,
  digits = 1,
  unit = "",
  height = 260,
  positiveColor = "var(--m-sarima)",
  negativeColor = "var(--m-hw)",
  showLabels = true,
}: {
  data: Row[];
  valueKey: string;
  nameKey: string;
  yLabel: string;
  digits?: number;
  unit?: string;
  height?: number;
  positiveColor?: string;
  negativeColor?: string;
  showLabels?: boolean;
}) {
  const tip = ({ active, payload, label }: TooltipContentProps) =>
    active && payload?.length ? (
      <TipBox
        title={String(label)}
        rows={[{ label: yLabel, value: `${Number(payload[0].value) > 0 ? "+" : ""}${Number(payload[0].value).toFixed(digits)}${unit}` }]}
      />
    ) : null;
  return (
    <div style={{ height }} className="w-full">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 18, right: 8, bottom: 4, left: 4 }} accessibilityLayer>
          <CartesianGrid vertical={false} stroke="var(--chart-grid)" />
          <XAxis dataKey={nameKey} tickLine={false} axisLine={false} tick={{ fontSize: 11, fill: "var(--muted-foreground)" }} minTickGap={4} />
          <YAxis
            tickLine={false}
            axisLine={false}
            width={52}
            tick={{ fontSize: 11, fill: "var(--muted-foreground)" }}
            label={{ value: yLabel, angle: -90, position: "insideLeft", offset: 6, style: { fontSize: 11, fill: "var(--muted-foreground)", textAnchor: "middle" } }}
          />
          <Tooltip content={tip} cursor={{ fill: "var(--muted)", opacity: 0.6 }} />
          <ReferenceLine y={0} stroke="var(--muted-foreground)" />
          <Bar dataKey={valueKey} radius={4} isAnimationActive={false} maxBarSize={36}>
            {data.map((r, i) => (
              <Cell key={i} fill={Number(r[valueKey]) >= 0 ? positiveColor : negativeColor} />
            ))}
            {showLabels && (
              <LabelList
                dataKey={valueKey}
                position="top"
                formatter={(v: unknown) => (typeof v === "number" ? `${v > 0 ? "+" : ""}${v.toFixed(digits)}${unit}` : "")}
                style={{ fontSize: 10, fill: "var(--foreground)" }}
              />
            )}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

/** Stacked horizontal bars (e.g. stockout vs excess units per model). */
export function StackedBars({
  data,
  stacks,
  nameKey = "model",
  xLabel,
  labelWidth = 170,
  digits = 1,
}: {
  data: Row[];
  stacks: { key: string; label: string; color: string }[];
  nameKey?: string;
  xLabel: string;
  labelWidth?: number;
  digits?: number;
}) {
  const tip = ({ active, payload, label }: TooltipContentProps) =>
    active && payload?.length ? (
      <TipBox
        title={String(label)}
        rows={payload.map((p, i) => ({ label: String(p.name), value: Number(p.value).toFixed(digits), color: stacks[i]?.color }))}
      />
    ) : null;
  return (
    <div style={{ height: Math.max(180, data.length * 44 + 56) }} className="w-full">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} layout="vertical" margin={{ top: 4, right: 24, bottom: 20, left: 4 }} accessibilityLayer>
          <CartesianGrid horizontal={false} stroke="var(--chart-grid)" />
          <XAxis
            type="number"
            tickLine={false}
            axisLine={false}
            tick={{ fontSize: 11, fill: "var(--muted-foreground)" }}
            label={{ value: xLabel, position: "insideBottom", offset: -12, fontSize: 11, fill: "var(--muted-foreground)" }}
          />
          <YAxis type="category" dataKey={nameKey} width={labelWidth} tickLine={false} axisLine={false} tick={{ fontSize: 11, fill: "var(--foreground)" }} />
          <Tooltip content={tip} cursor={{ fill: "var(--muted)", opacity: 0.6 }} />
          {stacks.map((s, i) => (
            <Bar
              key={s.key}
              dataKey={s.key}
              name={s.label}
              stackId="a"
              fill={s.color}
              barSize={18}
              radius={i === stacks.length - 1 ? [0, 4, 4, 0] : 0}
              stroke="var(--card)"
              strokeWidth={1}
              isAnimationActive={false}
            />
          ))}
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
