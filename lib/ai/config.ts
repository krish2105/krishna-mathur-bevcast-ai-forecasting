import "server-only";

/** Current Claude Sonnet-class model (Claude API model table, checked 2026-11-12). Overridable via env. */
export const DEFAULT_MODEL = "claude-sonnet-5-5";

export function llmConfig() {
  const key = process.env.ANTHROPIC_API_KEY;
  return {
    configured: typeof key === "string" && key.trim().length > 0,
    model: (process.env.ANTHROPIC_MODEL ?? "").trim() || DEFAULT_MODEL,
  };
}

/** Output cap per step: ~1,200 tokens of answer plus room for low-effort adaptive thinking. */
export const MAX_OUTPUT_TOKENS = 1600;
