"use client";

import Link from "next/link";
import * as React from "react";
import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport, type UIMessage } from "ai";
import { ArrowUp, Bot, Check, CheckCircle2, Copy, Loader2, RotateCcw, Square, Trash2, TriangleAlert, User, Wrench } from "lucide-react";
import { toast } from "sonner";
import { Markdown } from "@/components/ai/markdown";
import { ProvenanceBadge } from "@/components/common/provenance-badge";
import { useUpload } from "@/components/data/upload-context";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";

interface Meta {
  mode: "ai" | "fallback";
  model?: string;
  createdAt: string;
  sources?: ("reference" | "live" | "uploaded")[];
  dataAsOf?: string[];
  tools?: string[];
  finishReason?: string;
  notice?: string;
}
type Msg = UIMessage<Meta>;

export const SUGGESTED = [
  "Interpret the next three months' forecast.",
  "Which model performed best and why?",
  "Explain MAPE vs WAPE using our results.",
  "Did the product show seasonality or a trend?",
  "Why did the Random Forest look good in-sample but fail in Part 1?",
  "What production and distribution plan do you recommend?",
  "How does this week's weather outlook affect demand?",
  "Summarise everything for management.",
];

const TOOL_LABEL: Record<string, string> = {
  getAssignmentBrief: "Assignment brief",
  getDatasetSummary: "Dataset summary",
  getSalesHistory: "Sales history",
  getSeasonality: "Seasonality",
  getModelLeaderboard: "Model leaderboard",
  getForecast: "Forecast",
  getMetrics: "Metrics",
  getFirstYearScenario: "First-year scenario",
  getPart1Results: "Part 1 results",
  getLiveSignals: "Live signals",
  getUploadedDataResults: "Your upload",
};

const MAX_CHARS = 2000;

function ToolChip({ name, state }: { name: string; state: string }) {
  const done = state === "output-available";
  const failed = state === "output-error";
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px]",
        done ? "border-success/40 bg-success/10 text-success-fg" : failed ? "border-critical/40 bg-critical/10 text-critical-fg" : "border-border bg-muted text-muted-foreground",
      )}
      title={`Tool: ${name} (${state})`}
    >
      {done ? <CheckCircle2 className="size-3" /> : failed ? <TriangleAlert className="size-3" /> : <Loader2 className="size-3 animate-spin" />}
      <Wrench className="size-3" aria-hidden /> {TOOL_LABEL[name] ?? name}
    </span>
  );
}

function CopyButton({ text }: { text: string }) {
  const [ok, setOk] = React.useState(false);
  return (
    <Button
      variant="ghost"
      size="icon-xs"
      aria-label="Copy answer"
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(text);
          setOk(true);
          setTimeout(() => setOk(false), 1500);
        } catch {
          toast.error("Copy failed");
        }
      }}
    >
      {ok ? <Check /> : <Copy />}
    </Button>
  );
}

export function CopilotChat({ configured, model, initialPrompt = "" }: { configured: boolean; model: string; initialPrompt?: string }) {
  const { upload } = useUpload();
  // Only aggregated monthly values (<= 240) leave the browser, and only with a question.
  const uploaded = upload
    ? {
        fileName: upload.fileName.slice(0, 200),
        label: upload.label.slice(0, 200),
        months: upload.months.slice(-240),
        values: upload.values.slice(-240),
        uploadedAt: upload.uploadedAt,
        imputedMonths: upload.imputedMonths.slice(-240),
      }
    : null;
  const transport = React.useMemo(() => new DefaultChatTransport<Msg>({ api: "/api/chat" }), []);

  const { messages, sendMessage, status, stop, regenerate, setMessages, error, clearError } = useChat<Msg>({ transport });
  const [input, setInput] = React.useState(initialPrompt.slice(0, MAX_CHARS));
  const endRef = React.useRef<HTMLDivElement>(null);
  const busy = status === "submitted" || status === "streaming";

  React.useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messages, status]);

  const send = (text: string) => {
    const t = text.trim();
    if (!t || busy) return;
    if (t.length > MAX_CHARS) {
      toast.error(`Questions are limited to ${MAX_CHARS} characters.`);
      return;
    }
    clearError();
    void sendMessage({ text: t }, { body: { uploaded } });
    setInput("");
  };

  const errorText = error ? (() => {
    try {
      const j = JSON.parse(error.message) as { error?: string };
      return j.error ?? error.message;
    } catch {
      return error.message;
    }
  })() : null;

  return (
    <div className="grid gap-6 xl:grid-cols-[1fr_320px]">
      <div className="card-surface flex min-h-[560px] min-w-0 flex-col" data-testid="copilot">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border px-4 py-3">
          <div className="flex items-center gap-2 text-sm font-semibold">
            <Bot className="size-4 text-primary" aria-hidden /> BevCast AI Copilot
            {configured ? (
              <ProvenanceBadge kind="ai">Live LLM · {model}</ProvenanceBadge>
            ) : (
              <ProvenanceBadge kind="fallback" />
            )}
          </div>
          <Button variant="ghost" size="sm" onClick={() => setMessages([])} disabled={!messages.length || busy} aria-label="Clear conversation">
            <Trash2 /> Clear
          </Button>
        </div>

        {!configured && (
          <div className="m-4 mb-0 flex items-start gap-2 rounded-lg border border-warning/40 bg-warning/10 px-3 py-2 text-xs text-warning-fg" data-testid="llm-not-configured">
            <TriangleAlert className="mt-0.5 size-3.5 shrink-0" aria-hidden />
            <span>
              <strong>Live LLM not configured.</strong> Answers below are a deterministic, data-derived <em>rule-based fallback (not AI)</em>. Every number is
              still real; the wording is fixed templates. Add <code>ANTHROPIC_API_KEY</code> on the server to enable the live Copilot.
            </span>
          </div>
        )}

        <div className="flex-1 space-y-5 overflow-y-auto p-4" aria-live="polite">
          {messages.length === 0 && (
            <div className="space-y-4 py-4">
              <div className="text-center">
                <p className="text-base font-semibold">Ask about the forecasts, the models or the live signals</p>
                <p className="mx-auto mt-1 max-w-lg text-sm text-muted-foreground">
                  The Copilot calls tools that return the app&apos;s real numbers (notebook results, live FRED and weather feeds, and your upload) and is
                  told to use nothing else.
                </p>
              </div>
              <div className="grid gap-2 sm:grid-cols-2" data-testid="suggested-prompts">
                {SUGGESTED.map((s) => (
                  <button
                    key={s}
                    type="button"
                    onClick={() => send(s)}
                    className="rounded-lg border border-border bg-card px-3 py-2.5 text-left text-sm transition-colors hover:border-primary/50 hover:bg-accent/40"
                  >
                    {s}
                  </button>
                ))}
              </div>
            </div>
          )}

          {messages.map((m, idx) => {
            const text = m.parts.map((p) => (p.type === "text" ? p.text : "")).join("");
            const tools = m.parts.filter((p) => p.type.startsWith("tool-")) as unknown as { type: string; state: string; toolCallId: string }[];
            const meta = m.metadata;
            const isLast = idx === messages.length - 1;
            if (m.role === "user") {
              return (
                <div key={m.id} className="flex justify-end gap-2">
                  <div className="max-w-[85%] rounded-2xl rounded-br-md bg-primary px-3.5 py-2 text-sm whitespace-pre-wrap text-primary-foreground">{text}</div>
                  <span className="grid size-7 shrink-0 place-items-center rounded-full bg-muted" aria-hidden>
                    <User className="size-3.5" />
                  </span>
                </div>
              );
            }
            return (
              <div key={m.id} className="flex gap-2" data-testid="assistant-message">
                <span className="grid size-7 shrink-0 place-items-center rounded-full bg-accent text-accent-foreground" aria-hidden>
                  <Bot className="size-3.5" />
                </span>
                <div className="min-w-0 flex-1 space-y-2">
                  {tools.length > 0 && (
                    <div className="flex flex-wrap gap-1.5" aria-label="Data used">
                      {tools.map((t) => (
                        <ToolChip key={t.toolCallId} name={t.type.replace(/^tool-/, "")} state={t.state} />
                      ))}
                    </div>
                  )}
                  <div className="rounded-2xl rounded-tl-md border border-border bg-card px-3.5 py-2.5">
                    {text ? <Markdown>{text}</Markdown> : <p className="text-sm text-muted-foreground">Working…</p>}
                    {meta?.finishReason === "content-filter" && (
                      <p className="mt-2 text-xs text-warning-fg">The model declined part of this request (safety filter).</p>
                    )}
                    {meta?.finishReason === "length" && <p className="mt-2 text-xs text-warning-fg">The answer reached the length limit and may be cut off.</p>}
                  </div>
                  {(meta || text) && (
                    <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-[11px] text-muted-foreground">
                      {meta && <ProvenanceBadge kind={meta.mode === "ai" ? "ai" : "fallback"} className="h-5 text-[10px]" />}
                      {meta?.sources?.map((s) => (
                        <ProvenanceBadge key={s} kind={s === "uploaded" ? "uploaded" : s === "live" ? "live" : "reference"} className="h-5 text-[10px]">
                          {s === "uploaded" ? "Your upload" : s === "live" ? "Live" : "Reference"}
                        </ProvenanceBadge>
                      ))}
                      {meta?.dataAsOf && meta.dataAsOf.length > 0 && <span>Data as of: {meta.dataAsOf.join(" · ")}</span>}
                      {text && <CopyButton text={text} />}
                      {isLast && !busy && (
                        <Button variant="ghost" size="icon-xs" aria-label="Retry this answer" onClick={() => void regenerate({ body: { uploaded } })}>
                          <RotateCcw />
                        </Button>
                      )}
                    </div>
                  )}
                </div>
              </div>
            );
          })}

          {status === "submitted" && (
            <div className="flex items-center gap-2 text-sm text-muted-foreground" data-testid="typing">
              <Loader2 className="size-4 animate-spin" /> Thinking and calling tools…
            </div>
          )}
          {errorText && (
            <div role="alert" className="flex flex-wrap items-center gap-2 rounded-lg border border-critical/40 bg-critical/10 px-3 py-2 text-sm text-critical-fg">
              <TriangleAlert className="size-4" aria-hidden /> {errorText}
              <Button variant="outline" size="xs" onClick={() => void regenerate({ body: { uploaded } })}>
                Retry
              </Button>
            </div>
          )}
          <div ref={endRef} />
        </div>

        <form
          className="border-t border-border p-3"
          onSubmit={(e) => {
            e.preventDefault();
            send(input);
          }}
        >
          <div className="flex items-end gap-2">
            <label htmlFor="copilot-input" className="sr-only">
              Ask the Copilot
            </label>
            <Textarea
              id="copilot-input"
              data-testid="copilot-input"
              value={input}
              maxLength={MAX_CHARS}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  send(input);
                }
              }}
              placeholder="Ask about the forecast, models, seasonality, live signals or your upload…"
              className="max-h-40 min-h-11 resize-none"
              rows={1}
            />
            {busy ? (
              <Button type="button" variant="outline" size="icon-lg" onClick={() => void stop()} aria-label="Stop generating">
                <Square />
              </Button>
            ) : (
              <Button type="submit" size="icon-lg" disabled={!input.trim()} aria-label="Send" data-testid="copilot-send">
                <ArrowUp />
              </Button>
            )}
          </div>
          <p className="mt-1.5 text-[11px] text-muted-foreground">
            Enter to send, Shift+Enter for a new line · {input.length}/{MAX_CHARS} · Recommendations are suggestions, not executed actions.
          </p>
        </form>
      </div>

      <aside className="space-y-4">
        <div className="card-surface space-y-3 p-4 text-sm">
          <h2 className="font-semibold">Context the Copilot can use</h2>
          <ul className="space-y-2.5 text-xs">
            <li className="flex items-start gap-2">
              <ProvenanceBadge kind="reference" className="h-5 text-[10px]">
                Reference
              </ProvenanceBadge>
              <span className="text-muted-foreground">Notebook results: Part 1 (simulated demand + real temperature) and Part 2 (FRED proxy).</span>
            </li>
            <li className="flex items-start gap-2">
              <ProvenanceBadge kind="live" className="h-5 text-[10px]" />
              <span className="text-muted-foreground">
                FRED latest release and the 16-day Open-Meteo outlook, fetched when a question needs them.{" "}
                <Link href="/live" className="text-primary hover:underline">
                  See signals
                </Link>
              </span>
            </li>
            <li className="flex items-start gap-2">
              <ProvenanceBadge kind="uploaded" className="h-5 text-[10px]">
                Upload
              </ProvenanceBadge>
              <span className="text-muted-foreground" data-testid="copilot-upload-status">
                {upload ? (
                  <>
                    {upload.label}: {upload.values.length} months, sent as monthly values with each question.
                  </>
                ) : (
                  <>
                    None in this session.{" "}
                    <Link href="/data#upload" className="text-primary hover:underline">
                      Upload a CSV
                    </Link>
                  </>
                )}
              </span>
            </li>
          </ul>
        </div>
        <div className="card-surface space-y-2 p-4 text-xs text-muted-foreground">
          <h2 className="text-sm font-semibold text-foreground">Guardrails</h2>
          <p>Numbers come only from tool results; historical, test and forecast values are kept apart; simulated and proxy data are labelled.</p>
          <p>Text inside uploaded files is treated as data, never as instructions. 10 questions per minute.</p>
        </div>
      </aside>
    </div>
  );
}
