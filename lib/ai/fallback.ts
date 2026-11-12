/**
 * Rule-based fallback (NOT AI). Used only when no LLM key is configured or the LLM call fails.
 * Every number comes from the same data functions the Copilot's tools use. The UI labels this output
 * "Rule-based fallback (not AI)" and never presents it as LLM text.
 */
import "server-only";
import * as D from "@/lib/ai/data-tools";
import type { Source, UploadedPayload } from "@/lib/ai/schemas";
import { part1, part2 } from "@/lib/data/reference";
import { formatMonth } from "@/lib/forecasting/dates";

const p = (x: number | null | undefined) => (x === null || x === undefined ? "n/a" : `${x.toFixed(2)}%`);
const n2 = (x: number) => x.toFixed(2);

export interface FallbackAnswer {
  text: string;
  sources: Source[];
  asOf: string[];
  tools: string[];
}

function seasonality(): string {
  const s = D.getSeasonality();
  const top = [...s.seasonalIndex].sort((a, b) => b.index - a.index);
  const shape = [...s.testYearShape.rows].filter((r) => r.shape_corr !== null).sort((a, b) => (b.shape_corr ?? 0) - (a.shape_corr ?? 0));
  return [
    "### Seasonality and trend",
    `- **Seasonality is real but moderate** (STL seasonal strength ${n2(s.stl.strength_seasonal)}; trend strength ${n2(s.stl.strength_trend)}). Peak months: ${top
      .slice(0, 3)
      .map((t) => `${t.month} ${t.index.toFixed(3)}`)
      .join(", ")}; weakest: ${top
      .slice(-2)
      .map((t) => `${t.month} ${t.index.toFixed(3)}`)
      .join(", ")}.`,
    `- In the test year the actual seasonal swing was ${s.testYearShape.actual_amplitude_pct.toFixed(1)}% with the peak in ${s.testYearShape.actual_peak_month}. ${shape[0].model} (shape correlation ${n2(shape[0].shape_corr ?? 0)}) and ${shape[1].model} (${n2(shape[1].shape_corr ?? 0)}) followed the shape best; Naïve is flat by construction.`,
    `- ${s.part1Caution}`,
  ].join("\n");
}

function bestModel(): string {
  const h = D.getModelLeaderboard(2, "holdout") as { scores: { model: string; mape: number; wape: number; bias_pct: number }[] };
  const b = D.getModelLeaderboard(2, "backtest") as { scores: { model: string; mape: number; wape: number }[] };
  const best = part2.best_model;
  const hb = h.scores.find((s) => s.model === best)!;
  const hn = h.scores.find((s) => s.model === "Naïve")!;
  const bb = b.scores.find((s) => s.model === best)!;
  const bn = b.scores.find((s) => s.model === "Naïve")!;
  return [
    "### Best model and why",
    `- **${best}** has the lowest error on both tests: hold-out WAPE ${p(hb.wape)} (MAPE ${p(hb.mape)}) vs Naïve ${p(hn.wape)}, and 3-month rolling backtest WAPE ${p(bb.wape)} vs Naïve ${p(bn.wape)} (${part2.backtest.n_forecasts} forecasts).`,
    `- It tracks the level (bias ${p(hb.bias_pct)}) and most of the seasonal swing, using lag, rolling-mean and month features with shallow, regularised trees.`,
    `- Caution: at the 3-month horizon its margin over Naïve is small (${p(bb.wape)} vs ${p(bn.wape)}).`,
  ].join("\n");
}

function forecast(): string {
  const f = D.getForecast();
  return [
    `### Next three months (${f.model}, future forecast)`,
    ...f.months.map(
      (m) => `- **${formatMonth(m.month)}**: ${n2(m.forecast)} (SARIMA 80% ${n2(m.sarima80[0])}–${n2(m.sarima80[1])}; 95% ${n2(m.sarima95[0])}–${n2(m.sarima95[1])})`,
    ),
    `- Last actual: ${formatMonth(f.lastActual.month)} = ${n2(f.lastActual.value)}. The forecast eases into the usual Nov–Jan seasonal low (index points, category proxy).`,
  ].join("\n");
}

function plan(): string {
  const f = D.getForecast();
  return [
    "### Production and distribution (suggestions)",
    ...f.months.map(
      (m) =>
        `- ${formatMonth(m.month)}: plan around ${n2(m.forecast)} with a working range of ${n2(m.sarima80[0])}–${n2(m.sarima80[1])} (SARIMA 80%); keep upside capacity to ${n2(m.sarima95[1])} (95% high).`,
    ),
    "- Wind production down gradually into winter, and re-plan monthly as each new FRED release arrives.",
    "- These are recommendations from a category proxy, not orders.",
  ].join("\n");
}

function metricsExplainer(): string {
  const hn = part2.holdout.scores.find((s) => s.model === "Naïve")!;
  const p1n = part1.naive;
  return [
    "### MAPE vs WAPE with our results",
    "- **MAPE** averages each month's percentage error, so every month counts equally.",
    "- **WAPE** divides the total absolute error by total demand, so big months count more. It tracks the real cost of mis-planned volume.",
    `- Part 1 Naïve (Feb–Dec): MAPE ${p(p1n.mape)} but WAPE ${p(p1n.wape)}: the small spring and winter months had the largest percentage misses. Working: WAPE = ${p1n.sum_abs_error} / ${p1n.sum_demand}.`,
    `- Part 2 Naïve (hold-out): MAPE ${p(hn.mape)}, WAPE ${p(hn.wape)}: close, because the index moves in a narrow band.`,
  ].join("\n");
}

function part1Story(): string {
  const r = D.getPart1Results();
  const ins = r.inSample.scores.find((s) => s.model.startsWith("Random Forest"))!;
  const wf = r.walkForward.scores;
  const rf = wf.find((s) => s.model === "Random Forest (lags)")!;
  const best = wf[0];
  const naive = wf.find((s) => s.model === "Naïve")!;
  return [
    "### Why the Random Forest looked good in-sample but failed (Part 1, simulated demand)",
    `- Scored on its own training months (${part1.in_sample.window}) it reached MAPE ${p(ins.mape)}: that is fit, not forecasting.`,
    `- On unseen months (walk-forward ${r.walkForward.window}) it was worst: MAPE ${p(rf.mape)}, WAPE ${p(rf.wape)}, vs Naïve ${p(naive.mape)} / ${p(naive.wape)}.`,
    "- Trees cannot predict below the range they were trained on, and with 4–9 training rows they kept forecasting summer levels while demand fell.",
    `- The weather-adjusted regression was best: MAPE ${p(best.mape)}, WAPE ${p(best.wape)}.`,
  ].join("\n");
}

async function live(): Promise<{ text: string; asOf: string[] }> {
  const l = await D.getLiveSignals();
  const lines = ["### Live signals"];
  const asOf: string[] = [];
  if ("latest" in l.fred && l.fred.latest) {
    asOf.push(`FRED retrieved ${l.fred.retrievedAt}`);
    lines.push(
      `- FRED IPN31211N latest: ${formatMonth(l.fred.latest.month)} = ${n2(l.fred.latest.value)}. ${
        l.fred.newSinceNotebook.length ? `${l.fred.newSinceNotebook.length} new month(s) since the notebook run.` : "No new month since the notebook run (data to " + formatMonth(l.fred.notebookLastMonth) + ")."
      }`,
    );
  } else lines.push(`- FRED live feed unavailable (${"error" in l.fred ? l.fred.error : "unknown error"}).`);
  if ("usSummary" in l.weather && l.weather.usSummary) {
    const w = l.weather.usSummary;
    asOf.push(`Open-Meteo retrieved ${l.weather.retrievedAt}`);
    lines.push(
      `- 16-day outlook (${l.weather.window?.from} to ${l.weather.window?.to}): average daily max across 5 US metros ${w.forecastAvgMax.toFixed(1)} °C vs ${w.lastYearAvgMax.toFixed(
        1,
      )} °C on the same dates last year (${w.diff > 0 ? "+" : ""}${w.diff.toFixed(1)} °C; ${w.warmer} warmer, ${w.cooler} cooler).`,
    );
    lines.push(
      `- Reading: ${
        Math.abs(w.diff) < 1 ? "close to last year, so no weather adjustment to the plan is suggested" : w.diff > 0 ? "warmer than last year, so a small upside risk to cold-drink demand" : "cooler than last year, so a small downside risk to cold-drink demand"
      }. Weather is not a model input here.`,
    );
  } else lines.push(`- Weather feed unavailable (${"error" in l.weather ? l.weather.error : "unknown error"}).`);
  return { text: lines.join("\n"), asOf };
}

function uploadedText(uploaded: UploadedPayload | null | undefined): string {
  const u = D.getUploadedDataResults(uploaded);
  if (!u.available) return `### Your data\n- ${"message" in u ? u.message : "No upload."}`;
  const ok = u.leaderboard?.filter((r) => "holdoutWAPE" in r) ?? [];
  return [
    `### Your upload: ${u.name} (${u.window?.months} months, ${u.window?.from} to ${u.window?.to})`,
    ...(u.warnings ?? []).map((w) => `- ⚠ ${w}`),
    `- Best in-app model by backtest WAPE: **${u.bestModel ?? "none"}**.`,
    ...ok.slice(0, 7).map((r) => ("holdoutWAPE" in r ? `- ${r.model}: hold-out WAPE ${p(r.holdoutWAPE)}, backtest WAPE ${p(r.backtestWAPE)}` : "")),
    ...(u.next3Months ?? []).map((m) => `- Forecast ${formatMonth(m.month)}: ${n2(m.forecast)} (80% ${n2(m.low80)}–${n2(m.high80)})`),
  ].join("\n");
}

const FOOT = (src: string) => `\n\nSources: ${src}.`;

/** Executive summary answering the three Task 7 questions (fallback version). */
export async function fallbackSummary(): Promise<FallbackAnswer> {
  const l = await live();
  return {
    text: [seasonality(), bestModel(), plan(), l.text].join("\n\n") + FOOT(`reference notebook (${D.REFERENCE_AS_OF}); live feeds (${l.asOf.join("; ") || "unavailable"})`),
    sources: ["reference", "live"],
    asOf: [D.REFERENCE_AS_OF, ...l.asOf],
    tools: ["getSeasonality", "getModelLeaderboard", "getForecast", "getLiveSignals"],
  };
}

export async function fallbackAnswer(question: string, uploaded?: UploadedPayload | null): Promise<FallbackAnswer> {
  const q = question.toLowerCase();
  const ref = { sources: ["reference"] as Source[], asOf: [D.REFERENCE_AS_OF] };
  const tail = FOOT(`reference notebook (${D.REFERENCE_AS_OF})`);
  if (/upload|my data|my file|my csv/.test(q)) {
    return { text: uploadedText(uploaded) + FOOT("your upload, evaluated by the in-app engine"), sources: ["uploaded"], asOf: uploaded ? [uploaded.uploadedAt] : [], tools: ["getUploadedDataResults"] };
  }
  if (/weather|this week|live|real[- ]time|outlook|temperature/.test(q)) {
    const l = await live();
    return { text: l.text + FOOT(`live feeds (${l.asOf.join("; ") || "unavailable"})`), sources: ["live"], asOf: l.asOf, tools: ["getLiveSignals"] };
  }
  if (/summar|management|everything|overview|executive/.test(q)) return fallbackSummary();
  if (/in-sample|in sample|random forest|part 1|air cooler/.test(q)) return { text: part1Story() + FOOT("reference notebook (Part 1, simulated demand)"), ...ref, tools: ["getPart1Results"] };
  if (/mape|wape|metric/.test(q)) return { text: metricsExplainer() + tail, ...ref, tools: ["getModelLeaderboard", "getPart1Results"] };
  if (/production|distribution|plan|recommend/.test(q)) return { text: plan() + tail, ...ref, tools: ["getForecast"] };
  if (/season|trend/.test(q)) return { text: seasonality() + tail, ...ref, tools: ["getSeasonality"] };
  if (/best|perform|which model|why/.test(q)) return { text: bestModel() + tail, ...ref, tools: ["getModelLeaderboard"] };
  if (/forecast|next (three|3)|interpret|month/.test(q)) return { text: forecast() + tail, ...ref, tools: ["getForecast"] };
  return {
    text:
      "The live LLM is not configured, so I can only answer with fixed, data-derived templates. Try one of the suggested questions, for example the next-three-months forecast, the best model, MAPE vs WAPE, seasonality, Part 1's Random Forest, the production plan, this week's weather or a management summary.\n\n" +
      bestModel() +
      tail,
    ...ref,
    tools: ["getModelLeaderboard"],
  };
}
