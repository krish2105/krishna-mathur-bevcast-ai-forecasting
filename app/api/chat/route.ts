import {
  convertToModelMessages,
  createUIMessageStream,
  createUIMessageStreamResponse,
  isStepCount,
  streamText,
  toUIMessageStream,
  type UIMessage,
  type UIMessageStreamWriter,
} from "ai";
import { fallbackAnswer } from "@/lib/ai/fallback";
import { MAX_OUTPUT_TOKENS, PROVIDER_OPTIONS, geminiModel, llmConfig, llmErrorMessage } from "@/lib/ai/config";
import { clientIp, rateLimit } from "@/lib/ai/rate-limit";
import { ChatRequest, MAX_HISTORY, MAX_USER_CHARS, type ChatMetadata, type UploadedPayload } from "@/lib/ai/schemas";
import { SYSTEM_PROMPT } from "@/lib/ai/system-prompt";
import { buildTools, newTrace } from "@/lib/ai/tools";

export const maxDuration = 60;

type ChatUIMessage = UIMessage<ChatMetadata>;
type Writer = UIMessageStreamWriter<ChatUIMessage>;

function jsonError(status: number, error: string, extra: Record<string, unknown> = {}, headers: Record<string, string> = {}) {
  return Response.json({ error, ...extra }, { status, headers });
}

function textOf(m: { parts: { type: string; text?: unknown }[] }): string {
  return m.parts
    .filter((p) => p.type === "text" && typeof p.text === "string")
    .map((p) => p.text as string)
    .join("\n");
}

async function writeRuleBased(writer: Writer, question: string, uploaded: UploadedPayload | null, createdAt: string, notice: string) {
  const fb = await fallbackAnswer(question, uploaded);
  const id = "fallback-text";
  writer.write({ type: "start", messageMetadata: { mode: "fallback", createdAt, notice } });
  writer.write({ type: "text-start", id });
  writer.write({ type: "text-delta", id, delta: fb.text });
  writer.write({ type: "text-end", id });
  writer.write({
    type: "finish",
    messageMetadata: { mode: "fallback", createdAt, sources: fb.sources, dataAsOf: fb.asOf, tools: fb.tools, notice },
  });
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

  // Earlier turns are replayed as plain text only: tool calls, tool results and reasoning from previous answers
  // are dropped (the model re-calls tools when it needs numbers), so no stale provider metadata is sent back.
  const messages = rawMessages
    .slice(-MAX_HISTORY)
    .map((m) => ({ ...m, parts: m.parts.filter((p) => p.type === "text") }))
    .filter((m) => m.parts.length > 0) as unknown as ChatUIMessage[];

  const cfg = llmConfig();
  const createdAt = new Date().toISOString();

  const stream = createUIMessageStream<ChatUIMessage>({
    originalMessages: messages,
    execute: async ({ writer }) => {
      if (!cfg.configured) {
        await writeRuleBased(writer, question, uploaded, createdAt, "Live LLM not configured");
        return;
      }
      const modelMessages = await convertToModelMessages(messages, { tools: buildTools(uploaded, newTrace()) });
      let lastError: unknown = null;

      // Free-tier quotas are small: try the primary model, then the fallback model, then the labelled rule-based
      // answer. An attempt's chunks are held back until its first text arrives, so a failed attempt leaves no trace.
      for (const modelId of cfg.models) {
        const trace = newTrace();
        const tools = buildTools(uploaded, trace);
        let streamError: unknown = null;
        const result = streamText({
          model: geminiModel(modelId),
          instructions: SYSTEM_PROMPT,
          messages: modelMessages,
          tools,
          stopWhen: isStepCount(6),
          maxOutputTokens: MAX_OUTPUT_TOKENS,
          maxRetries: 0,
          abortSignal: req.signal,
          // Grounding: the first step must call a tool, so every answer starts from the app's data.
          prepareStep: ({ stepNumber }) => (stepNumber === 0 ? { toolChoice: "required" as const } : { toolChoice: "auto" as const }),
          providerOptions: PROVIDER_OPTIONS,
          onError: ({ error }) => {
            streamError = error;
            const detail = error instanceof Error ? `${error.name}: ${error.message}` : JSON.stringify(error);
            console.error(`[chat] ${modelId} stream error: ${detail.slice(0, 600)}`);
          },
        });
        const ui = toUIMessageStream<typeof tools, ChatUIMessage>({
          stream: result.stream,
          tools,
          sendReasoning: false,
          sendFinish: false,
          onError: (e) => {
            streamError = streamError ?? e;
            return llmErrorMessage(e);
          },
          messageMetadata: ({ part }) => (part.type === "start" ? ({ mode: "ai", model: modelId, createdAt } satisfies ChatMetadata) : undefined),
        });

        // The whole attempt is buffered and only sent once it has finished without error, so a provider failure
        // (free-tier quota, "high demand" overload) at any point moves cleanly to the next model and the user never
        // sees a half-written answer.
        const held: Parameters<Writer["write"]>[0][] = [];
        let failedMidway = false;
        let hasText = false;
        const reader = ui.getReader();
        for (;;) {
          const { done, value } = await reader.read();
          if (done) break;
          if (value.type === "error") {
            failedMidway = true;
            continue;
          }
          if (value.type === "text-delta" && value.delta.trim()) hasText = true;
          held.push(value);
        }
        if (req.signal.aborted) return; // the user pressed Stop

        let finishReason: string | undefined;
        try {
          finishReason = await result.finishReason;
        } catch {
          finishReason = "error";
        }
        if (failedMidway || streamError || !hasText || finishReason === "error" || trace.called.length === 0) {
          lastError = streamError ?? new Error(trace.called.length === 0 ? "The model answered without reading the data (no tool call)." : "The model returned no text.");
          console.error(`[chat] ${modelId} produced no complete answer:`, lastError instanceof Error ? lastError.message : lastError);
          continue; // try the next model
        }
        for (const c of held) writer.write(c);
        writer.write({
          type: "finish",
          messageMetadata: {
            mode: "ai",
            model: modelId,
            createdAt,
            sources: [...trace.sources],
            dataAsOf: [...trace.asOf.entries()].map(([k, v]) => `${k}: ${v}`),
            tools: [...new Set(trace.called)],
            finishReason,
            notice: modelId === cfg.models[0] ? undefined : `Answered by the backup model ${modelId} (primary model busy).`,
          } satisfies ChatMetadata,
        });
        return;
      }

      await writeRuleBased(writer, question, uploaded, createdAt, `${llmErrorMessage(lastError)} This answer is the rule-based fallback.`);
    },
  });

  return createUIMessageStreamResponse({ stream });
}
