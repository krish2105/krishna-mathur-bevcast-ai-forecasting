import { z } from "zod";

export const MAX_UPLOAD_POINTS = 240;
export const MAX_USER_CHARS = 2000;
export const MAX_HISTORY = 24;

/** Aggregated monthly values the browser may send with a chat request (never raw rows). */
export const UploadedPayload = z
  .object({
    fileName: z.string().max(200),
    label: z.string().max(200),
    months: z.array(z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/)).min(6).max(MAX_UPLOAD_POINTS),
    values: z.array(z.number().finite()).min(6).max(MAX_UPLOAD_POINTS),
    uploadedAt: z.string().max(40),
    imputedMonths: z.array(z.string()).max(MAX_UPLOAD_POINTS).optional(),
  })
  .refine((u) => u.months.length === u.values.length, { message: "months and values must have the same length" });
export type UploadedPayload = z.infer<typeof UploadedPayload>;

const Part = z.object({ type: z.string() }).passthrough();
export const ChatMessageSchema = z
  .object({
    id: z.string().max(100),
    role: z.enum(["user", "assistant"]),
    parts: z.array(Part).max(200),
    metadata: z.unknown().optional(),
  })
  .passthrough();

export const ChatRequest = z.object({
  id: z.string().max(100).optional(),
  messages: z.array(ChatMessageSchema).min(1).max(60),
  uploaded: UploadedPayload.nullable().optional(),
  trigger: z.string().optional(),
  messageId: z.string().optional(),
});

export const SummaryRequest = z.object({ force: z.boolean().optional() });

export type Source = "reference" | "live" | "uploaded";

export interface ChatMetadata {
  mode: "ai" | "fallback";
  model?: string;
  createdAt: string;
  sources?: Source[];
  dataAsOf?: string[];
  tools?: string[];
  finishReason?: string;
  notice?: string;
}

/** Strip anything that could read like an instruction from user-provided labels. */
export function sanitizeLabel(s: string): string {
  return s.replace(/[^\p{L}\p{N} ._\-()/]/gu, "").slice(0, 80);
}
