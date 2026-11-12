import { BookOpen, Bot, CheckCircle2, Cpu, FlaskConical, Layers, Radio, ScrollText } from "lucide-react";
import { cn } from "@/lib/utils";

export type Provenance = "simulated" | "real" | "proxy" | "live" | "reference" | "engine" | "fallback" | "ai" | "uploaded";

const STYLES: Record<Provenance, { label: string; icon: typeof BookOpen; cls: string; title: string }> = {
  simulated: {
    label: "Simulated",
    icon: FlaskConical,
    cls: "border-warning/40 bg-warning/10 text-warning-fg",
    title: "Simulated teaching data from the professor's reference notebook; not observed sales",
  },
  real: {
    label: "Real",
    icon: CheckCircle2,
    cls: "border-success/40 bg-success/10 text-success-fg",
    title: "Real observed data from an official public source",
  },
  proxy: {
    label: "Proxy",
    icon: Layers,
    cls: "border-accent-2/40 bg-accent-2/10 text-info-fg",
    title: "Real category data (FRED IPN31211N) standing in for the company's own sales",
  },
  live: {
    label: "Live",
    icon: Radio,
    cls: "border-primary/40 bg-primary/10 text-teal-fg",
    title: "Fetched from a public API at request time",
  },
  reference: {
    label: "Reference (notebook)",
    icon: BookOpen,
    cls: "border-border bg-muted text-foreground",
    title: "Precomputed in Python by the executed notebook and verified by the export script",
  },
  engine: {
    label: "In-app engine",
    icon: Cpu,
    cls: "border-violet-fg/40 bg-violet-fg/10 text-violet-fg",
    title: "Computed live in TypeScript from the data shown",
  },
  fallback: {
    label: "Rule-based fallback (not AI)",
    icon: ScrollText,
    cls: "border-warning/40 bg-warning/10 text-warning-fg",
    title: "Deterministic text built from the data; no language model was called",
  },
  ai: {
    label: "AI-generated",
    icon: Bot,
    cls: "border-primary/40 bg-primary/10 text-teal-fg",
    title: "Written by an LLM from numbers returned by the app's tools",
  },
  uploaded: {
    label: "Your upload (this session)",
    icon: Layers,
    cls: "border-violet-fg/40 bg-violet-fg/10 text-violet-fg",
    title: "Data you uploaded; parsed in this browser and never stored on the server",
  },
};

export function ProvenanceBadge({ kind, className, children }: { kind: Provenance; className?: string; children?: React.ReactNode }) {
  const s = STYLES[kind];
  const Icon = s.icon;
  return (
    <span
      title={s.title}
      className={cn(
        "inline-flex h-6 shrink-0 items-center gap-1 rounded-full border px-2 text-xs font-medium whitespace-nowrap",
        s.cls,
        className,
      )}
    >
      {kind === "live" ? (
        <span className="live-dot size-1.5 rounded-full bg-primary" aria-hidden />
      ) : (
        <Icon className="size-3" aria-hidden />
      )}
      {children ?? s.label}
    </span>
  );
}
