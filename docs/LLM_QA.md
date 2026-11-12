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

## Run 2: live LLM (Claude, `claude-sonnet-5-5`)

Pending: run once `ANTHROPIC_API_KEY` is added to the Vercel production environment.
