import { ArrowDownRight, ArrowUpRight, Minus } from "lucide-react";
import { InfoTip } from "@/components/common/info-tip";
import { Sparkline } from "@/components/charts/sparkline";
import type { GlossaryTerm } from "@/lib/glossary";
import { cn } from "@/lib/utils";

export interface KpiDelta {
  /** Text shown in the chip, e.g. "−39% vs Naïve" */
  text: string;
  /** Whether this delta is good news (green), bad (red) or neutral */
  tone: "good" | "bad" | "neutral";
  direction: "up" | "down" | "flat";
}

export function KpiCard({
  label,
  value,
  unit,
  sub,
  delta,
  term,
  tip,
  spark,
  sparkColor = "var(--primary)",
  badge,
  className,
  testId,
}: {
  label: string;
  value: string;
  unit?: string;
  sub?: React.ReactNode;
  delta?: KpiDelta;
  term?: GlossaryTerm;
  tip?: string;
  spark?: number[];
  sparkColor?: string;
  badge?: React.ReactNode;
  className?: string;
  testId?: string;
}) {
  const Icon = delta?.direction === "up" ? ArrowUpRight : delta?.direction === "down" ? ArrowDownRight : Minus;
  return (
    <div data-testid={testId} className={cn("card-surface flex h-full min-w-0 flex-col gap-3 p-4 md:p-5", className)}>
      <div className="flex items-start justify-between gap-2">
        <div className="flex min-w-0 items-center gap-1 text-[13px] leading-5 font-medium text-muted-foreground">
          <span className="text-pretty">{label}</span>
          {(term || tip) && <InfoTip term={term} text={tip} label={label} />}
        </div>
        {badge}
      </div>
      <div className="flex items-end justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-baseline gap-1">
            <span className="text-[28px] leading-9 font-semibold tracking-tight tabular-nums">{value}</span>
            {unit && <span className="text-sm text-muted-foreground">{unit}</span>}
          </div>
          {sub && <div className="mt-0.5 text-xs text-muted-foreground">{sub}</div>}
        </div>
        {spark && spark.length > 1 && (
          <div className="h-10 w-24 shrink-0" aria-hidden>
            <Sparkline values={spark} color={sparkColor} />
          </div>
        )}
      </div>
      {delta && (
        <span
          className={cn(
            "inline-flex w-fit items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium",
            delta.tone === "good" && "bg-success/10 text-success-fg",
            delta.tone === "bad" && "bg-critical/10 text-critical-fg",
            delta.tone === "neutral" && "bg-muted text-muted-foreground",
          )}
        >
          <Icon className="size-3" aria-hidden />
          {delta.text}
        </span>
      )}
    </div>
  );
}
