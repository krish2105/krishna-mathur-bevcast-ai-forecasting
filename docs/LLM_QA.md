# LLM QA

How the Copilot was checked:
1. The 8 suggested prompts were sent to the production `/api/chat`, using `scripts/llm_qa.mjs`.
2. The script parsed each streamed answer and extracted every number in it.
3. Each number was checked against the set of values the tools can return: `data/part1.json`, `data/part2.json`, the last 36 FRED months and the live `/api/live/fred` and `/api/live/weather` responses at run time. A value matches if it equals a tool value rounded to 0–3 decimals, or that value expressed as a percentage above or below 1.
4. Structural numbers (horizons, counts, years, list markers) and timestamps are ignored.
5. Every unmatched number is reviewed by hand below.

Raw outputs, including the full answer text, tools called, sources and data-as-of: `docs/qa/llm-qa-*.json`.

## Run 1: rule-based fallback (no API key configured)

Base URL https://bevcast-ai.vercel.app · run at 2026-11-12T11:22:40.585Z

| # | Prompt | Mode | Tools used | Numbers in answer | Unmatched |
|---|---|---|---|---|---|
| 1 | Interpret the next three months' forecast. | fallback | getForecast | 22 | 0 |
| 2 | Which model performed best and why? | fallback | getModelLeaderboard | 11 | 0 |
| 3 | Explain MAPE vs WAPE using our results. | fallback | getModelLeaderboard, getPart1Results | 8 | 0 |
| 4 | Did the product show seasonality or a trend? | fallback | getSeasonality | 12 | 0 |
| 5 | Why did the Random Forest look good in-sample but fail in Part 1? | fallback | getPart1Results | 11 | 0 |
| 6 | What production and distribution plan do you recommend? | fallback | getForecast | 18 | 0 |
| 7 | How does this week's weather outlook affect demand? | fallback | getLiveSignals | 7 | 0 |
| 8 | Summarise everything for management. | fallback | getSeasonality, getModelLeaderboard, getForecast, getLiveSignals | 48 | 0 |

**Result:**
- All 137 numbers across the 8 answers trace to tool outputs, with 0 unmatched.
- Every answer is labelled "Rule-based fallback (not AI)" and carries "Data as of" stamps:
  - reference notebook run 2026-11-12;
  - FRED and Open-Meteo retrieval times for the live answers.

## Run 2: live LLM (Google Gemini)

Base URL https://bevcast-ai.vercel.app · run at 2026-11-12T12:03:52.997Z. Model chain: `gemini-3.5-flash-lite`, then `gemini-3.1-flash-lite`, then `gemini-3.6-flash`, then the rule-based fallback.

| # | Prompt | Answered by | Tools used | Numbers in answer | Unmatched | Time |
|---|---|---|---|---|---|---|
| 1 | Interpret the next three months' forecast. | gemini-3.5-flash-lite | getForecast | 41 | 283.76 | 4.4 s |
| 2 | Which model performed best and why? | gemini-3.5-flash-lite | getModelLeaderboard | 15 | 0 | 12.3 s |
| 3 | Explain MAPE vs WAPE using our results. | gemini-3.5-flash-lite | getModelLeaderboard | 15 | 0 | 6.4 s |
| 4 | Did the product show seasonality or a trend? | gemini-3.5-flash-lite | getSeasonality | 13 | 0 | 2.9 s |
| 5 | Why did the Random Forest look good in-sample but fail in Part 1? | gemini-3.1-flash-lite | getPart1Results | 6 | 0 | 8.2 s |
| 6 | What production and distribution plan do you recommend? | gemini-3.1-flash-lite | getUploadedDataResults, getForecast, getPart1Results | 20 | 0 | 13.8 s |
| 7 | How does this week's weather outlook affect demand? | gemini-3.5-flash-lite | getLiveSignals | 15 | 0 | 2.3 s |
| 8 | Summarise everything for management. | gemini-3.5-flash-lite | getDatasetSummary, getModelLeaderboard, getPart1Results, getLiveSignals | 16 | 0 | 4.6 s |

**Result:**
- All 8 answers were written by Gemini, and every one started from a tool call.
- Of the 141 numbers quoted, every one traces to a tool output.
- The only "unmatched" value is **283.76**, the `threeMonthTotal` that `getForecast` itself returns (95.30 + 94.93 + 93.53). It is a tool value; the checker simply doesn't list derived tool fields.
- A manual read of the key claims confirms they match the notebook:
  - XGBoost is best in Part 2 (hold-out WAPE 1.57%, 39.37% better than Naïve; backtest 2.14%).
  - The weather-adjusted regression is best in Part 1 (WAPE 11.98% vs Naïve 15.96%).
  - Forecasts and SARIMA intervals are exact.

### Problems found during testing, and the fixes

| Problem | Evidence | Fix |
|---|---|---|
| Free-tier quota exhausted | `gemini-3.6-flash`: "Generate content requests per day limit exceeded on Free Tier … limit: 20" | Flash-Lite models are now primary, with a 3-model backup chain and `maxRetries: 0` |
| Provider overload mid-answer | "This model is currently experiencing high demand" after part of the text had streamed | Each attempt is buffered and released only when complete, so a failure moves to the next model |
| Ungrounded answer | A backup model answered "Summarise everything" with **no tool call** and invented wrong findings ("Random Forest best in Part 1", "SARIMA leads Part 2") | The first step is forced to call a tool (`toolChoice: "required"`, Gemini `ANY` mode), and answers with no tool call are rejected |
| Mixed live-data snapshots | One answer quoted Dubai 29.1 °C while `/api/live/weather` had just refreshed to 29.2 °C | Not an error: both are live values with their own retrieval timestamps ("Data as of" line) |

Raw answers: `docs/qa/llm-qa-gemini.json`.
