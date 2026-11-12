import { generateText, isStepCount } from "ai";
import { MAX_OUTPUT_TOKENS, PROVIDER_OPTIONS, geminiModel, llmConfig, llmErrorMessage } from "@/lib/ai/config";
import { fallbackSummary } from "@/lib/ai/fallback";
import { clientIp, rateLimit } from "@/lib/ai/rate-limit";
import { SummaryRequest } from "@/lib/ai/schemas";
import { SUMMARY_PROMPT, SYSTEM_PROMPT } from "@/lib/ai/system-prompt";
import { buildTools, newTrace } from "@/lib/ai/tools";

export const maxDuration = 60;

interface SummaryPayload {
  mode: "ai" | "fallback";
  text: string;
  model?: string;
  generatedAt: string;
  dataAsOf: string[];
  tools: string[];
  cached?: boolean;
  notice?: string;
}

// One AI summary per server instance per hour, so page views do not each call the LLM.
let cache: { at: number; payload: SummaryPayload } | null = null;
const TTL_MS = 60 * 60 * 1000;

export async function POST(req: Request) {
  let force = false;
  try {
    const parsed = SummaryRequest.safeParse(await req.json());
    force = parsed.success ? !!parsed.data.force : false;
  } catch {
    /* empty body is fine */
  }
  const cfg = llmConfig();

  if (!cfg.configured) {
    const fb = await fallbackSummary();
    return Response.json({
      mode: "fallback",
      text: fb.text,
      generatedAt: new Date().toISOString(),
      dataAsOf: fb.asOf,
      tools: fb.tools,
      notice: "Live LLM not configured",
    } satisfies SummaryPayload);
  }

  if (!force && cache && Date.now() - cache.at < TTL_MS) return Response.json({ ...cache.payload, cached: true });

  const rl = rateLimit(`summary:${clientIp(req)}`, force ? 3 : 10);
  if (!rl.ok) return Response.json({ error: `Too many requests. Try again in ${rl.retryAfter} s.` }, { status: 429, headers: { "Retry-After": String(rl.retryAfter) } });

  let lastError: unknown = null;
  for (const modelId of cfg.models) {
    const trace = newTrace();
    const tools = buildTools(null, trace);
    try {
      const res = await generateText({
        model: geminiModel(modelId),
        instructions: SYSTEM_PROMPT,
        prompt: SUMMARY_PROMPT,
        tools,
        stopWhen: isStepCount(6),
        maxOutputTokens: MAX_OUTPUT_TOKENS,
        maxRetries: 0,
        abortSignal: AbortSignal.timeout(25_000),
        prepareStep: ({ stepNumber }) => (stepNumber === 0 ? { toolChoice: "required" as const } : { toolChoice: "auto" as const }),
        providerOptions: PROVIDER_OPTIONS,
      });
      if (!res.text.trim()) throw new Error(`Empty answer (finish reason ${res.finishReason})`);
      if (trace.called.length === 0) throw new Error("The model answered without reading the data (no tool call).");
      const payload: SummaryPayload = {
        mode: "ai",
        text: res.text,
        model: modelId,
        generatedAt: new Date().toISOString(),
        dataAsOf: [...trace.asOf.entries()].map(([k, v]) => `${k}: ${v}`),
        tools: [...new Set(trace.called)],
        notice: modelId === cfg.models[0] ? undefined : `Answered by the backup model ${modelId} (primary model busy).`,
      };
      cache = { at: Date.now(), payload };
      return Response.json(payload);
    } catch (e) {
      lastError = e;
      console.error(`[summary] ${modelId} failed:`, e instanceof Error ? e.message : e);
    }
  }
  {
    const e = lastError;
    console.error("[summary] LLM error:", e instanceof Error ? e.message : e);
    const fb = await fallbackSummary();
    return Response.json({
      mode: "fallback",
      text: fb.text,
      generatedAt: new Date().toISOString(),
      dataAsOf: fb.asOf,
      tools: fb.tools,
      notice: `${llmErrorMessage(e)} The rule-based summary is shown instead.`,
    } satisfies SummaryPayload);
  }
}
