"use client";

import Link from "next/link";
import * as React from "react";
import { Bot, RefreshCw, Sparkles, TriangleAlert } from "lucide-react";
import { Markdown } from "@/components/ai/markdown";
import { ProvenanceBadge } from "@/components/common/provenance-badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";

interface Summary {
  mode: "ai" | "fallback";
  text: string;
  model?: string;
  generatedAt: string;
  dataAsOf: string[];
  tools: string[];
  cached?: boolean;
  notice?: string;
  error?: string;
}

const KEY = "bevcast.summary.v1";

export function ExecutiveSummary() {
  const [data, setData] = React.useState<Summary | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);

  const load = React.useCallback(async (force: boolean) => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/summary", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ force }),
      });
      const json = (await res.json()) as Summary;
      if (!res.ok) throw new Error(json.error ?? `Request failed (${res.status})`);
      setData(json);
      try {
        window.sessionStorage.setItem(KEY, JSON.stringify(json));
      } catch {
        /* ignore */
      }
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }, []);

  React.useEffect(() => {
    let cached: Summary | null = null;
    try {
      const raw = window.sessionStorage.getItem(KEY);
      cached = raw ? (JSON.parse(raw) as Summary) : null;
    } catch {
      cached = null;
    }
    if (cached) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- show this tab's cached summary without another LLM call
      setData(cached);
      setLoading(false);
    } else {
      void load(false);
    }
  }, [load]);

  return (
    <section id="ai-summary" aria-labelledby="ai-summary-title" className="card-surface scroll-mt-20 overflow-hidden" data-testid="ai-summary">
      <div className="flex flex-col gap-3 border-b border-border p-4 sm:flex-row sm:items-center sm:justify-between md:p-5">
        <div className="space-y-1">
          <h2 id="ai-summary-title" className="flex items-center gap-2 text-[15px] font-semibold">
            <Sparkles className="size-4 text-primary" aria-hidden /> AI executive summary
          </h2>
          <p className="text-xs text-muted-foreground">
            Answers the three Task 7 questions from the app&apos;s data, including live FRED and weather signals.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {data && <ProvenanceBadge kind={data.mode === "ai" ? "ai" : "fallback"} />}
          <Button variant="outline" size="sm" onClick={() => load(true)} disabled={loading} aria-label="Regenerate summary">
            <RefreshCw className={loading ? "animate-spin" : ""} /> Regenerate
          </Button>
        </div>
      </div>
      <div className="p-4 md:p-5" aria-live="polite" aria-busy={loading}>
        {data?.notice && (
          <div className="mb-3 flex items-start gap-2 rounded-lg border border-warning/40 bg-warning/10 px-3 py-2 text-xs text-warning-fg">
            <TriangleAlert className="mt-0.5 size-3.5 shrink-0" aria-hidden />
            <span>
              {data.notice}
              {data.mode === "fallback" && ". This text is assembled by fixed rules from the data; it is not written by an AI model."}
            </span>
          </div>
        )}
        {loading && !data ? (
          <div className="space-y-2">
            <Skeleton className="h-4 w-1/3" />
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-11/12" />
            <Skeleton className="h-4 w-4/5" />
            <p className="pt-1 text-xs text-muted-foreground">Calling the tools and the language model…</p>
          </div>
        ) : error && !data ? (
          <p className="text-sm text-critical-fg">Could not load the summary: {error}</p>
        ) : data ? (
          <div className={loading ? "opacity-60 transition-opacity" : ""}>
            <Markdown>{data.text}</Markdown>
          </div>
        ) : null}
      </div>
      {data && (
        <div className="flex flex-col gap-1 border-t border-border bg-muted/40 px-4 py-2.5 text-[11px] text-muted-foreground md:px-5">
          <span>
            <strong className="font-medium">Data as of:</strong> {data.dataAsOf.join(" · ") || "n/a"}
          </span>
          <span className="flex flex-wrap items-center gap-x-3 gap-y-1">
            <span>
              {data.mode === "ai" ? (
                <>
                  <Bot className="mr-1 inline size-3" aria-hidden />
                  {data.model} · generated {new Date(data.generatedAt).toUTCString()}
                  {data.cached ? " (cached)" : ""}
                </>
              ) : (
                <>Rule-based fallback · built {new Date(data.generatedAt).toUTCString()}</>
              )}
            </span>
            {data.tools.length > 0 && <span>Tools: {data.tools.join(", ")}</span>}
            <Link href="/copilot" className="text-teal-fg underline underline-offset-2">
              Ask a follow-up →
            </Link>
          </span>
        </div>
      )}
    </section>
  );
}
