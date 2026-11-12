#!/usr/bin/env node
/**
 * LLM QA: sends the Copilot's 8 suggested prompts to /api/chat, then checks every number in each answer
 * against the numbers the tools can return (reference JSON + live feeds). Unmatched numbers are listed for
 * manual review (they may be correct arithmetic on tool values, or errors).
 *
 *   node scripts/llm_qa.mjs https://bevcast-ai.vercel.app > docs/qa/llm-qa-<mode>.json
 */
import fs from "node:fs";

const BASE = process.argv[2] ?? "http://localhost:3000";
const PROMPTS = [
  "Interpret the next three months' forecast.",
  "Which model performed best and why?",
  "Explain MAPE vs WAPE using our results.",
  "Did the product show seasonality or a trend?",
  "Why did the Random Forest look good in-sample but fail in Part 1?",
  "What production and distribution plan do you recommend?",
  "How does this week's weather outlook affect demand?",
  "Summarise everything for management.",
];

// ---- numbers the tools can return ----
const allowed = new Set();
const addNum = (v) => {
  if (typeof v !== "number" || !Number.isFinite(v)) return;
  for (const x of [v, Math.abs(v)]) {
    for (const d of [0, 1, 2, 3]) allowed.add(Number(x.toFixed(d)));
    allowed.add(Number(((1 - x) * 100).toFixed(1))); // seasonal index as % above/below
    allowed.add(Number(((x - 1) * 100).toFixed(1)));
  }
};
const walk = (o) => {
  if (Array.isArray(o)) o.forEach(walk);
  else if (o && typeof o === "object") Object.values(o).forEach(walk);
  else if (typeof o === "number") addNum(o);
  else if (typeof o === "string") for (const m of o.matchAll(/-?\d+(?:\.\d+)?/g)) addNum(Number(m[0]));
};
for (const f of ["data/part1.json", "data/part2.json"]) walk(JSON.parse(fs.readFileSync(new URL(`../${f}`, import.meta.url))));
walk((JSON.parse(fs.readFileSync(new URL("../data/series.json", import.meta.url)))).fred_monthly.slice(-36));
for (const p of ["/api/live/fred", "/api/live/weather"]) {
  try {
    walk(await (await fetch(BASE + p)).json());
  } catch {
    /* live feed unavailable */
  }
}

// numbers that are structural, not data (horizons, counts, years, list markers)
const STRUCTURAL = new Set([0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 12, 16, 18, 24, 36, 54, 100, 165, 177, 2017, 2023, 2024, 2025, 2026]);

function numbersIn(text) {
  const t = text
    .replace(/\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2}(\.\d+)?)?Z?/g, " ") // ISO timestamps (data-as-of)
    .replace(/\b\d{1,2}:\d{2}(:\d{2})?\b/g, " ") // clock times
    .replace(/\b\d{4}-\d{2}(-\d{2})?\b/g, " ").replace(/\b(19|20)\d{2}\b/g, " ").replace(/\(\d+,\s*\d+,\s*\d+(,\s*\d+)?\)/g, " ");
  return [...t.matchAll(/[−-]?\d+(?:\.\d+)?/g)].map((m) => Number(m[0].replace("−", "-")));
}

async function ask(prompt) {
  const body = { messages: [{ id: "u1", role: "user", parts: [{ type: "text", text: prompt }] }] };
  const t0 = Date.now();
  const res = await fetch(`${BASE}/api/chat`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
  if (!res.ok) return { prompt, error: `${res.status} ${await res.text()}` };
  const raw = await res.text();
  let text = "";
  const tools = [];
  let meta = {};
  for (const line of raw.split("\n")) {
    if (!line.startsWith("data: ") || line === "data: [DONE]") continue;
    let ev;
    try {
      ev = JSON.parse(line.slice(6));
    } catch {
      continue;
    }
    if (ev.type === "text-delta") text += ev.delta;
    if (ev.type === "tool-input-available") tools.push(ev.toolName);
    if (ev.messageMetadata) meta = { ...meta, ...ev.messageMetadata };
    if (ev.type === "error") text += `\n[stream error: ${ev.errorText}]`;
  }
  const nums = numbersIn(text);
  const unmatched = [...new Set(nums.filter((n) => !STRUCTURAL.has(Math.abs(n)) && !allowed.has(n) && !allowed.has(Math.abs(n))))];
  return { prompt, ms: Date.now() - t0, mode: meta.mode, model: meta.model, tools: meta.tools ?? tools, sources: meta.sources, dataAsOf: meta.dataAsOf, finishReason: meta.finishReason, numbers: nums.length, unmatched, text };
}

const out = [];
for (const p of PROMPTS) {
  out.push(await ask(p));
  await new Promise((r) => setTimeout(r, Number(process.env.QA_GAP_MS ?? 7000))); // stay under the rate limits
}
console.log(JSON.stringify({ base: BASE, ranAt: new Date().toISOString(), results: out }, null, 2));
