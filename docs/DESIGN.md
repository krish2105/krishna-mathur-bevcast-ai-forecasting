# Design brief: BEVCAST AI

*Forecast better. Produce smarter. Distribute with confidence.*

The design is a calm, precise analytics studio. Light theme is the default; the dark theme is fully supported. Every number reads as data: tabular, aligned and labelled with where it came from.

## Grid and layout

| Item | Rule |
|---|---|
| Spacing | 8-pt scale: 4, 8, 12, 16, 24, 32, 48, 64 px |
| Content | 12-column grid, max width 1440 px |
| Page gutters | 16 px mobile, 24 px tablet, 32 px desktop |
| Sidebar | 264 px expanded, 72 px collapsed; becomes a drawer below 1024 px |
| Top bar | Sticky, 56 px: page title, data-freshness badge, ⌘K, theme toggle, student badge |
| Cards | 12 px radius, 1 px border, soft shadow (`0 1px 2px rgb(16 24 40 / .05)`), 16–24 px padding |
| KPI rows | Equal-height cards (CSS grid `auto-rows-fr`); stack to one column below 640 px |
| Tables | Numbers right-aligned; long tables scroll inside their own container; 40 px rows |
| Overflow | No horizontal page scroll at 375 px; charts simplify (fewer ticks, legend below) rather than shrink |

## Type scale

Geist Sans for text and Geist Mono for code. Every number uses `font-variant-numeric: tabular-nums`.

| Role | Size / line height | Weight |
|---|---|---|
| Display (hero) | 36 / 40 (30 on mobile) | 600 |
| Page title | 24 / 32 | 600 |
| Section title | 18 / 28 | 600 |
| Card title | 14 / 20 | 500 |
| Body | 14 / 22 | 400 |
| Small / caption | 12 / 16 | 400–500 |
| KPI value | 30 / 36 | 600, tabular |

## Colour tokens

All tokens are CSS variables. Light is the default, and dark is applied with the `.dark` class.

| Token | Light | Dark |
|---|---|---|
| background | #F7F9FC | #0B1220 |
| surface / card | #FFFFFF | #111A2B |
| text-primary | #172B4D | #E6EDF7 |
| text-secondary | #667085 | #9AA8BD |
| border | #E5EAF0 | #1E2A3D |
| accent-primary | #087E8B | #2BB3C0 |
| accent-secondary | #3478C5 | #6FA8E8 |
| warning | #D99025 | #E8A945 |
| critical | #D94B4B | #EF6B6B |

**Fixed model colours.** These are the same in every chart, legend and table, and match the notebook:

| Series | Colour |
|---|---|
| Actual | #1F2A44 (navy; #C9D4E5 in dark mode so it stays visible) |
| Naïve | #E07A1F |
| Seasonal Naïve | #B08D57 |
| SARIMA | #C0392B |
| Holt-Winters | #2E86C1 |
| Random Forest | #2A9D8F |
| XGBoost | #7B61B0 |
| Weather-adjusted (Part 1 only) | #C0392B |

The in-app engine models reuse the nearest family colour: Holt-Winters (both variants) take blue, ridge regression takes teal-green, and seasonal-index transfer takes amber.

**Data-provenance badges.** Each badge pairs a colour with an icon and a word, so colour is never the only signal:

| Badge | Colour | Icon |
|---|---|---|
| Simulated | amber | flask |
| Real | green | check |
| Proxy | blue | layers |
| Live | teal with a pulsing dot | radio |
| Reference (notebook) | navy | book |
| In-app engine | violet | cpu |

**Contrast** (computed with the WCAG 2.x formula):
- Text must reach at least 4.5:1 and chart strokes at least 3:1.
- `text-secondary` #667085 measures 4.97:1 on white and 4.72:1 on the page background.
- The accent #087E8B measures 4.81:1 on white.
- Every model colour reaches at least 3.0:1 on white (Naïve is the lowest, at 3.01:1). On the dark card, every model colour except "Actual" reaches at least 3.2:1, so "Actual" switches to #C9D4E5 in dark mode (11.6:1).
- The light-mode warning #D99025 (2.64:1) and critical #D94B4B (4.15:1) fail as small text. They are used only for fills and icons. Text uses `--warning-fg` #8F5A00 (5.78:1) and `--critical-fg` #B42318 (6.57:1).
- In dark mode the base warning (8.45:1) and critical (5.79:1) colours pass as text.

## Chart rules (Recharts)

1. **Title and units:** every chart has a title with units, for example "Index (2017 = 100)", and an axis label.
2. **Grid and axes:** horizontal gridlines only, at border colour and 60% opacity. No axis lines and no tick lines. Short month ticks ("Oct 25"); `tickMargin` 8.
3. **Actual line:** a solid 2.5 px line with dots. Forecasts are dashed 2 px lines, and the selected best model is drawn thicker.
4. **Prediction intervals:** a soft band at 12% opacity (80%) inside a 6% band (95%), in the model's colour, with a legend entry.
5. **Annotations:** a vertical divider marks "train | test | forecast", with a text label. Peaks carry a small label.
6. **Tooltip:** one shared crosshair tooltip with the month as its header and one row per series: colour dot, name and a right-aligned tabular value.
7. **Legend:** a clickable legend toggles series. Hidden series show a struck-through label, and the "Models" checkboxes do the same.
8. **Accessible data:** every chart has a "View data" disclosure holding a real `<table>`, and `accessibilityLayer` is on.
9. **Export:** each chart can be exported as PNG (`html-to-image`) or CSV.
10. **Small screens:** below 640 px the legend sits below the plot and the tick count halves.

## Motion

- **Default timing:** 150–250 ms, ease-out. Cards and sections fade and rise 8 px on first view.
- **Charts:** lines draw in once on mount.
- **Reduced motion:** under `prefers-reduced-motion: reduce` all motion is off, including chart animation and the pulsing live dot.
- **What stays still:** no parallax and no looping animation except the live dot.

## States

| State | Treatment |
|---|---|
| Loading | Skeletons in the final layout (`loading.tsx` per route); no spinner-only screens |
| Empty | One-line cause plus one action, e.g. "No upload yet: use the reference dataset or upload a CSV" |
| Error | Plain-language message, what still works, a Retry button. An error boundary per route and a global one. |
| Fallback (no LLM key) | "Live LLM not configured" notice and a "Rule-based fallback (not AI)" badge; never styled as AI output |
| Stale live data | A freshness badge turns amber once data are older than 24 h |

## Voice

Labels are plain ("Units mis-planned", not "Inefficiency score"). The app never overstates: "recommendation", not "order placed"; "category proxy", not "sales". The AI copilot says where each number came from.
