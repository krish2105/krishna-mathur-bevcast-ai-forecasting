import "server-only";
import { createGoogleGenerativeAI } from "@ai-sdk/google";

/**
 * Google Gemini via the Vercel AI SDK. Default model: gemini-3.6-flash, labelled "Stable" and available on the
 * Gemini API free tier (Google AI Studio models and pricing pages, checked 2026-11-12). Overridable via env.
 */
export const DEFAULT_MODEL = "gemini-3.6-flash";
export const PROVIDER_NAME = "Google Gemini";

function apiKey(): string | undefined {
  const key = process.env.GOOGLE_GENERATIVE_AI_API_KEY ?? process.env.GEMINI_API_KEY;
  return key && key.trim().length > 0 ? key.trim() : undefined;
}

/** Safe to pass to pages: says whether a key exists and which model is used, never the key itself. */
export function llmConfig() {
  return {
    configured: apiKey() !== undefined,
    model: (process.env.GEMINI_MODEL ?? "").trim() || DEFAULT_MODEL,
    provider: PROVIDER_NAME,
  };
}

/** Server-side model handle. */
export function geminiModel(modelId: string) {
  return createGoogleGenerativeAI({ apiKey: apiKey() })(modelId);
}

/** Low thinking effort keeps chat latency and free-tier token use down. */
export const PROVIDER_OPTIONS = {
  google: { thinkingConfig: { thinkingLevel: "low" as const, includeThoughts: false } },
};

/** Output cap per step: ~1,200 tokens of answer plus room for low-effort thinking. */
export const MAX_OUTPUT_TOKENS = 1600;

/** Plain-language message for a failed model call (no internals, no key material). */
export function llmErrorMessage(e: unknown): string {
  const m = e instanceof Error ? e.message : String(e);
  if (/API key|PERMISSION_DENIED|401|403|unauthori[sz]ed|invalid.*key/i.test(m)) {
    return "The Gemini API key was rejected. Ask the site owner to check GOOGLE_GENERATIVE_AI_API_KEY.";
  }
  if (/429|RESOURCE_EXHAUSTED|quota|rate/i.test(m)) {
    return "The Gemini free-tier quota is used up for the moment. Please retry in a minute.";
  }
  return "The language model could not answer right now. Please retry.";
}
