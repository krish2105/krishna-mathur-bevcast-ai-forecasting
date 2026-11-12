# Research notes

Research for BEVCAST AI, done on 12 Nov 2026 before any UI code was written. Package facts were verified in the installed packages' type definitions, bundled docs and a scratch build, not from memory.

## 1. Toolchain (Phase 0)

| Tool | Version | Status |
|---|---|---|
| Node.js | 26.10.0 | Vercel's default runtime is also 26.x |
| npm | 11.19.1 | |
| Python | 3.14.7 | Same minor version as the executed notebook |
| GitHub CLI | 2.101.0 | Logged in as `krish2105` |
| Vercel CLI | 60.0.0 | Logged in |

## 2. Chosen versions and why

| Package | Version | Reason |
|---|---|---|
| next | 16.4.6 | Latest stable. App Router, Turbopack default for dev and build. |
| react / react-dom | 19.3.1 | Latest stable (create-next-app pinned 19.3.0; bumped). |
| typescript | 6.0.3 | Latest release with the JavaScript compiler API. TypeScript 7.0.2 (latest tag) is the native port: it no longer ships `lib/typescript.js`, which Next.js uses for its type-check step, and the typescript-eslint inside eslint-config-next 16.4.6 rejects TS 7 (`peer typescript <6.1.0`). |
| tailwindcss | 4.3.5 | Latest; CSS-first config, loaded by `@tailwindcss/turbopack`. |
| shadcn (CLI) | 4.23.0 | `init -b radix`: version 4 defaults to Base UI, so Radix is chosen explicitly. Components are copied into `components/ui`. |
| recharts | 3.10.1 | shadcn's `chart` component targets Recharts v3. One chart library is used everywhere. |
| ai | 7.0.170 | Vercel AI SDK 7: `streamText` with `instructions`, `tool({ inputSchema })`, `isStepCount`, async `convertToModelMessages`, `createUIMessageStreamResponse` + `toUIMessageStream`. ESM only, Node 22 or later. |
| @ai-sdk/anthropic | 4.0.102 | Provider options `effort`, `thinking`, `fallbacks` (adds the `server-side-fallback-2026-07-01` beta header itself). Refusal maps to `finishReason: "content-filter"`. |
| @ai-sdk/react | 4.0.174 | `useChat` with `DefaultChatTransport({ api, body })`, `status`, `stop`, `regenerate`, tool parts `tool-<name>`. |
| zod | 4.6.7 | Tool input schemas and API validation. |
| motion | 14.12.0 | Motion (formerly Framer Motion); `useReducedMotion` respected. |
| cmdk / sonner | 1.1.1 / 2.0.8 | Command palette and toasts (shadcn wrappers). |
| papaparse | 5.7.1 | CSV parsing in the browser. |
| @tanstack/react-table | 9.3.1 | Sortable data tables. |
| katex | 0.19.1 | MAPE/WAPE formulas on the Methodology page. |
| vitest | 5.1.0 | Unit tests (Vite 8). |
| @playwright/test | 1.65.0 | End-to-end tests, local and against production. |
| @axe-core/playwright | 4.14.0 | Accessibility scan inside the e2e suite. |
| eslint | 10.14.0 | Latest; eslint-config-next 16.4.6 needs `>=9` and was tested with 10. |

### Framework facts that shaped the code

- **Next.js 16.4**
  - `params` and `searchParams` are Promises.
  - `middleware.ts` is now `proxy.ts`.
  - `next lint` is gone, so ESLint runs directly.
  - `fetch` is not cached by default.
  - create-next-app 16.4.6 turns on `cacheComponents`. With it on, the `revalidate` segment export errors, so it is **turned off**. The live-data routes then use plain ISR (`revalidate = 21600`, 6 hours).
- **Claude Sonnet 5.5 (`claude-sonnet-5-5`)** is the current Sonnet-class model ID, from the Claude API reference cached 2026-11-03. Its constraints:
  - No `temperature`: the provider strips it.
  - Forced `tool_choice` returns a 400, so `auto` is used.
  - Thinking cannot be disabled. It runs adaptive at `effort: "low"` for chat latency.
  - Thinking blocks are bound to the conversation. The system prompt stays byte-stable, live data arrives only through tool results, and earlier turns are replayed without reasoning parts. Removing all earlier thinking blocks is allowed.
  - Refusals are routed by `fallbacks: "default"`.
- **Vercel**
  - Fluid compute is on by default. Hobby functions get a 300 s default and maximum, and `maxDuration = 60` is set for the chat route.
  - Node 26.x is the default runtime.
  - The Python runtime allows 500 MB bundles.

### Decision: no Python runtime on Vercel

SARIMA, Random Forest and XGBoost results stay **reference-only**: they are precomputed from the executed notebook. A Python function holding statsmodels, scikit-learn and xgboost would fit the 500 MB limit. It would still add a slow cold start, a second deployment target and a second set of numbers to keep consistent. The TypeScript engine already gives real, tested forecasts for uploaded data, so the brief's condition ("only add it if it fits **and** is needed") is not met. Model availability is shown honestly as Evaluated / Reference / Not run.

## 3. UI research (patterns, not brands)

Sources read: ui.shadcn.com (blocks, chart docs), tremor.so, vercel.com/geist (introduction, colors), stripe.com/blog/accessible-color-systems, mercury.com/insights. linear.app/method returned only a table of contents and is not relied on.

| Source | Patterns taken |
|---|---|
| shadcn blocks and charts | Sidebar plus inset shell with an icon-collapse mode. A slim header holding a trigger, a separator and the page title. Page order: KPI cards, then the hero chart, then the table. `ChartConfig` keeps per-series colours as CSS variables. Horizontal gridlines only, no axis or tick lines, `tickMargin` 10, `accessibilityLayer` on charts. |
| Tremor | KPI card anatomy: label, headline value, delta badge (percentage), optional spark chart. Filters as segmented controls. |
| Geist | Sans plus mono pairing, with mono for numbers. Stepped neutral scale with fixed roles (backgrounds, borders, secondary and primary text). Solid 1 px borders preferred to heavy shadows. |
| Stripe accessible colour systems | Contrast of 4.5:1 for text and 3:1 for icons and large text. Never shift hue by darkening alone. Meaning is never carried by colour alone. |
| Mercury | Plain-language labels. Charts paired with tables that update together. Restrained claims about AI. |

The resulting rules are in [DESIGN.md](DESIGN.md).

## 4. Feature research (professional demand-planning tools)

| Feature | How professional tools present it | Source |
|---|---|---|
| Forecast vs actual | History plus forecast lines, filterable by model | Nixtla statsforecast docs |
| Prediction intervals | Shaded 80% and 95% fan that widens with the horizon | Hyndman & Athanasopoulos, *FPP3* §5.5 |
| Quantile forecasts | P10–P90 band around a P50 line | Amazon Forecast metrics docs |
| Model leaderboard | Metric table; lowest error wins; ties broken by a second metric | Amazon Forecast; Nixtla |
| Backtesting | Several rolling windows, metrics per window and pooled | Amazon Forecast; *FPP3* §5.10 |
| Accuracy metrics | MAPE, WAPE, RMSE; WAPE is preferred for volume-weighted cost | Amazon Forecast metrics docs |
| What-if scenarios | Adjust a driver and recompute the plan | SageMaker Canvas time-series docs |
| Data-quality checks | Required columns, date formats, missing-value handling made explicit | SageMaker Canvas docs |
| Forecast value added | Every model compared with the naïve benchmark | SAS forecasting blog (Gilliland), search snippet only |

### Feature → assignment task map

| Assignment requirement | Feature in BEVCAST AI | Page |
|---|---|---|
| Part 1 objective: Naïve vs ML with MAPE and WAPE | Naïve working table; in-sample vs walk-forward comparison; MAPE/WAPE bars; stockout vs excess units | `/lab-air-coolers` |
| Task 1: lag features, seasonal indicators | Feature table (lags 1–3, 12, rolling means, month sin/cos) with correlations; in-app ridge model on lags + month | `/analysis`, `/methodology` |
| Task 2: choose a model | Model leaderboard of six reference models plus in-app models, with rationale | `/models` |
| Task 3: train-test split | Train / test / forecast divider on charts; rolling-origin backtest settings | `/forecasting`, `/models` |
| Task 4: next 3 months | Exactly-3-month forecast with 80/95% bands and a forecast table | `/forecasting`, `/` |
| Task 5: MAPE and WAPE | Metric tables, glossary tooltips, KaTeX formulas, zero-actual handling | `/models`, `/methodology` |
| Task 6: actual vs predicted | Test-period overlay with model toggles, residual plot, "View data" table | `/models`, `/forecasting` |
| Task 7: interpret insights | Evidence-based answers to the three questions; first-year scenario; production-range table; what-if slider | `/insights` |
| LLM on real-time data | Tool-calling Copilot grounded on live FRED and Open-Meteo feeds plus uploaded data; AI executive summary | `/copilot`, `/live`, `/` |
| Data handling | Reference dataset card, data-quality report, browser-only CSV upload | `/data` |

Skipped on purpose (out of scope per the brief): reorder points, safety-stock optimisation and Bayesian inventory.

## 5. Day 10 of RDMU

**Not found.** I searched `~/Desktop` to depth 6 for names containing "RDMU", "Day 10", "Day10" and "Day_10", and ran a Spotlight search for "RDMU". The only RDMU file on the Mac is an RDMU *individual assignment* deck in iCloud Downloads, not Day 10 course material. Nothing from Day 10 is quoted or assumed. The notebook follows the professor's reference Colab, which uses `google.colab.ai`. The web app uses the Anthropic API through the Vercel AI SDK.
