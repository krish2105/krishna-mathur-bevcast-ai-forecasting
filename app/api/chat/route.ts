import { createAnthropic } from "@ai-sdk/anthropic";
import {
  convertToModelMessages,
  createUIMessageStream,
  createUIMessageStreamResponse,
  isStepCount,
  streamText,
  toUIMessageStream,
  type UIMessage,
} from "ai";
import { fallbackAnswer } from "@/lib/ai/fallback";
import { MAX_OUTPUT_TOKENS, llmConfig } from "@/lib/ai/config";
import { clientIp, rateLimit } from "@/lib/ai/rate-limit";
import { ChatRequest, MAX_HISTORY, MAX_USER_CHARS, type ChatMetadata } from "@/lib/ai/schemas";
import { SYSTEM_PROMPT } from "@/lib/ai/system-prompt";
import { buildTools, newTrace } from "@/lib/ai/tools";

export const maxDuration = 60;

type ChatUIMessage = UIMessage<ChatMetadata>;

function jsonError(status: number, error: string, extra: Record<string, unknown> = {}, headers: Record<string, string> = {}) {
  return Response.json({ error, ...extra }, { status, headers });
}

function textOf(m: { parts: { type: string; text?: unknown }[] }): string {
  return m.parts
    .filter((p) => p.type === "text" && typeof p.text === "string")
    .map((p) => p.text as string)
    .join("\n");
}

export async function POST(req: Request) {
  const rl = rateLimit(`chat:${clientIp(req)}`, 10);
  if (!rl.ok) {
    return jsonError(429, `Rate limit reached: 10 questions per minute. Try again in ${rl.retryAfter} s.`, {}, { "Retry-After": String(rl.retryAfter) });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return jsonError(400, "Request body must be JSON.");
  }
  const parsed = ChatRequest.safeParse(body);
  if (!parsed.success) return jsonError(400, "Invalid chat request.", { issues: parsed.error.issues.slice(0, 5).map((i) => i.message) });

  const { messages: rawMessages, uploaded = null } = parsed.data;
  const last = rawMessages.at(-1)!;
  const question = textOf(last as never);
  if (last.role !== "user" || question.trim().length === 0) return jsonError(400, "The last message must be a non-empty user question.");
  if (question.length > MAX_USER_CHARS) return jsonError(413, `Questions are limited to ${MAX_USER_CHARS} characters.`);

  // Keep the most recent turns; drop earlier reasoning (removing all prior thinking blocks keeps the
  // conversation valid) and anything that is not a user or assistant message.
  const messages = rawMessages.slice(-MAX_HISTORY).map((m) => ({
    ...m,
    parts: m.parts.filter((p) => p.type !== "reasoning" && p.type !== "step-start"),
  })) as unknown as ChatUIMessage[];

  const cfg = llmConfig();
  const createdAt = new Date().toISOString();

  if (!cfg.configured) {
    const fb = await fallbackAnswer(question, uploaded);
    const stream = createUIMessageStream<ChatUIMessage>({
      execute: ({ writer }) => {
        const id = "fallback-text";
        writer.write({ type: "start", messageMetadata: { mode: "fallback", createdAt, notice: "Live LLM not configured" } });
        writer.write({ type: "text-start", id });
        writer.write({ type: "text-delta", id, delta: fb.text });
        writer.write({ type: "text-end", id });
        writer.write({
          type: "finish",
          messageMetadata: { mode: "fallback", createdAt, sources: fb.sources, dataAsOf: fb.asOf, tools: fb.tools, notice: "Live LLM not configured" },
        });
      },
    });
    return createUIMessageStreamResponse({ stream });
  }

  const trace = newTrace();
  const tools = buildTools(uploaded, trace);
  const anthropic = createAnthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

  const result = streamText({
    model: anthropic(cfg.model),
    instructions: SYSTEM_PROMPT,
    messages: await convertToModelMessages(messages, { tools }),
    tools,
    stopWhen: isStepCount(6),
    maxOutputTokens: MAX_OUTPUT_TOKENS,
    abortSignal: req.signal,
    providerOptions: {
      anthropic: {
        effort: "low",
        // Server-side fallback for classifier refusals (the provider adds the beta header itself).
        fallbacks: "default",
      },
    },
    onError: ({ error }) => {
      console.error("[chat] stream error:", error instanceof Error ? error.message : error);
    },
  });

  return createUIMessageStreamResponse({
    stream: toUIMessageStream<typeof tools, ChatUIMessage>({
      stream: result.stream,
      tools,
      originalMessages: messages,
      sendReasoning: false,
      onError: (e) =>
        e instanceof Error && /401|authentication|api key/i.test(e.message)
          ? "The LLM key was rejected. Ask the site owner to check ANTHROPIC_API_KEY."
          : "The language model could not answer right now. Please retry.",
      messageMetadata: ({ part }) => {
        if (part.type === "start") return { mode: "ai", model: cfg.model, createdAt } satisfies ChatMetadata;
        if (part.type === "finish") {
          return {
            mode: "ai",
            model: cfg.model,
            createdAt,
            sources: [...trace.sources],
            dataAsOf: [...trace.asOf.entries()].map(([k, v]) => `${k}: ${v}`),
            tools: [...new Set(trace.called)],
            finishReason: part.finishReason,
          } satisfies ChatMetadata;
        }
        return undefined;
      },
    }),
  });
}
