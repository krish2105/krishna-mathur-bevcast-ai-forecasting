"use client";

import * as React from "react";
import { RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import { formatMonth } from "@/lib/forecasting/dates";

export interface PlanRow {
  month: string;
  forecast: number;
  pi80: [number, number];
  pi95: [number, number];
}

const WARM_ASSUMPTION = 2; // % — illustrative, not a model output

/**
 * Production and distribution plan for the next 3 months. The base numbers are the notebook's XGBoost
 * forecast and SARIMA intervals; the what-if controls apply a user-chosen scenario on top and are labelled.
 */
export function PlanWhatIf({ rows, lastActual, model }: { rows: PlanRow[]; lastActual: number; model: string }) {
  const [shock, setShock] = React.useState(0);
  const [warm, setWarm] = React.useState(false);
  const factor = 1 + (shock + (warm ? WARM_ASSUMPTION : 0)) / 100;
  const scenario = shock !== 0 || warm;

  const plan = rows.map((r, i) => {
    const f = r.forecast * factor;
    const lo = r.pi80[0] * factor;
    const hi = r.pi80[1] * factor;
    const prev = i === 0 ? lastActual : rows[i - 1].forecast * factor;
    const change = (f / prev - 1) * 100;
    const action =
      change <= -1
        ? "Ease production gradually; shift stock toward warmer regions first"
        : change >= 1
          ? "Raise production; pre-position stock at distribution centres"
          : "Hold production steady; replenish to forecast";
    return { ...r, f, lo, hi, hi95: r.pi95[1] * factor, change, action };
  });

  return (
    <div className="space-y-4">
      <div className="card-surface grid gap-5 p-4 md:grid-cols-[1fr_auto] md:items-end md:p-5" data-print-hide>
        <div className="space-y-3">
          <div className="flex items-center justify-between gap-3">
            <Label htmlFor="shock">Demand shock (what-if)</Label>
            <span className="text-sm font-semibold tabular-nums">
              {shock > 0 ? "+" : ""}
              {shock}%
            </span>
          </div>
          <Slider id="shock" min={-10} max={10} step={1} value={[shock]} onValueChange={(v) => setShock(v[0])} aria-label="Demand shock in percent" />
          <div className="flex items-center gap-2">
            <Switch id="warm" checked={warm} onCheckedChange={setWarm} />
            <Label htmlFor="warm" className="font-normal">
              Warmer-than-normal weather (illustrative +{WARM_ASSUMPTION}% assumption)
            </Label>
          </div>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={() => {
            setShock(0);
            setWarm(false);
          }}
          disabled={!scenario}
        >
          <RotateCcw /> Reset
        </Button>
      </div>
      {scenario && (
        <p className="rounded-lg border border-warning/40 bg-warning/10 px-3 py-2 text-xs text-warning-fg" role="status">
          Scenario view: forecast and ranges are scaled by {((factor - 1) * 100).toFixed(0)}%. This is a user assumption on top of the model output, not a
          new forecast.
        </p>
      )}
      <div className="overflow-x-auto rounded-lg border border-border" role="region" aria-label="Production and distribution plan" tabIndex={0} data-testid="plan-table">
        <table className="w-full min-w-[760px] border-collapse text-sm">
          <caption className="sr-only">Suggested production ranges for the next three months</caption>
          <thead className="bg-muted text-xs text-muted-foreground">
            <tr>
              <th scope="col" className="px-3 py-2 text-left font-medium">Month</th>
              <th scope="col" className="px-3 py-2 text-right font-medium">{model} forecast</th>
              <th scope="col" className="px-3 py-2 text-right font-medium">vs previous</th>
              <th scope="col" className="px-3 py-2 text-right font-medium">Suggested production range (80%)</th>
              <th scope="col" className="px-3 py-2 text-right font-medium">Upside capacity (95% high)</th>
              <th scope="col" className="px-3 py-2 text-left font-medium">Recommendation</th>
            </tr>
          </thead>
          <tbody>
            {plan.map((p) => (
              <tr key={p.month} className="border-t border-border">
                <td className="px-3 py-2 font-medium whitespace-nowrap">{formatMonth(p.month)}</td>
                <td className="px-3 py-2 text-right tabular-nums">{p.f.toFixed(2)}</td>
                <td className="px-3 py-2 text-right tabular-nums">
                  {p.change > 0 ? "+" : ""}
                  {p.change.toFixed(1)}%
                </td>
                <td className="px-3 py-2 text-right tabular-nums whitespace-nowrap">
                  {p.lo.toFixed(2)} – {p.hi.toFixed(2)}
                </td>
                <td className="px-3 py-2 text-right tabular-nums">{p.hi95.toFixed(2)}</td>
                <td className="px-3 py-2 text-xs">{p.action}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="text-xs text-muted-foreground">
        Units are index points of the category proxy (2017 = 100): convert to the brand&apos;s own volumes before use. Ranges use SARIMA&apos;s 80% and
        95% prediction intervals (the notebook computed intervals for SARIMA only). These are recommendations, not orders.
      </p>
    </div>
  );
}
