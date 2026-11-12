import type { Metadata } from "next";
import katex from "katex";
import { PageHeader, Section } from "@/components/common/page-header";
import { ProvenanceBadge, type Provenance } from "@/components/common/provenance-badge";
import { SimpleTable } from "@/components/common/simple-table";
import { meta, part1, part2 } from "@/lib/data/reference";

export const metadata: Metadata = {
  title: "Methodology & Sources",
  description: "MAPE and WAPE formulas, validation design, models, data sources and licences, the provenance legend, limitations and references.",
};

function Tex({ tex, block = false }: { tex: string; block?: boolean }) {
  const html = katex.renderToString(tex, { displayMode: block, throwOnError: false, output: "htmlAndMathml" });
  return block ? (
    <div className="overflow-x-auto py-2" dangerouslySetInnerHTML={{ __html: html }} />
  ) : (
    <span dangerouslySetInnerHTML={{ __html: html }} />
  );
}

const MODELS = [
  { name: "Naïve", fam: "Benchmark", how: "Last observed value repeated: ŷ(T+h) = y(T).", where: "Notebook + in-app" },
  { name: "Seasonal Naïve", fam: "Benchmark", how: "Same month last year: ŷ(T+h) = y(T+h−12).", where: "Notebook + in-app (parity-tested)" },
  { name: `SARIMA ${part2.sarima.label.replace("SARIMA", "")}`, fam: "ARIMA", how: "Differencing removes trend and seasonality; AR/MA terms model the rest. Orders chosen by AIC on training data.", where: "Notebook (reference)" },
  { name: "Holt-Winters", fam: "Exponential smoothing", how: "Weighted averages of level, damped trend and seasonal factors.", where: "Notebook (multiplicative) + in-app (additive and multiplicative)" },
  { name: "Random Forest", fam: "Machine learning", how: "500 trees on lag, rolling-mean and month features; recursive multi-step forecasting.", where: "Notebook (reference)" },
  { name: "XGBoost", fam: "Machine learning", how: "400 gradient-boosted trees (depth 3, learning rate 0.05) on the same features.", where: "Notebook (reference)" },
  { name: "Weather-adjusted regression", fam: "Regression (Part 1)", how: "D̂(t) = D(t−1) + α + β·ΔT(t), α and β by least squares on past months.", where: "Notebook (reference)" },
  { name: "Ridge regression", fam: "Regression", how: "Closed-form ridge on lags 1–3 (+12 with 3+ years) and month sin/cos; recursive.", where: "In-app engine" },
  { name: "Seasonal-index transfer", fam: "New product", how: "Recent de-seasonalised level × the category's monthly seasonal index.", where: "Notebook + in-app (parity-tested)" },
];

const LEGEND: { kind: Provenance; text: string }[] = [
  { kind: "real", text: "Observed data from an official public source (Open-Meteo temperatures, FRED values)." },
  { kind: "simulated", text: "Part 1 air-cooler demand: teaching data from the professor's reference notebook." },
  { kind: "proxy", text: "Part 2: real FRED category index standing in for the company's own sales." },
  { kind: "live", text: "Fetched from FRED or Open-Meteo at request time, shown with its retrieval time." },
  { kind: "reference", text: "Computed in Python by the executed notebook and re-verified by the export script." },
  { kind: "engine", text: "Computed live in TypeScript in this app from the data shown." },
  { kind: "uploaded", text: "Your CSV, parsed in your browser for this session only." },
  { kind: "ai", text: "Text written by the LLM from tool results." },
  { kind: "fallback", text: "Fixed templates filled with real numbers when no LLM is available." },
];

export default function MethodologyPage() {
  return (
    <div className="space-y-10" data-testid="page-methodology">
      <PageHeader
        title="Methodology and sources"
        description="How every number in the app was produced, how models were validated and where the data came from."
      />

      <Section id="metrics" title="MAPE and WAPE" notebookRef="1.3, 2.10">
        <div className="grid gap-4 lg:grid-cols-2">
          <div className="card-surface space-y-2 p-5">
            <h3 className="font-semibold">Mean Absolute Percentage Error</h3>
            <Tex block tex={String.raw`\text{MAPE} = \frac{100\%}{n}\sum_{t=1}^{n}\left|\frac{A_t - F_t}{A_t}\right|`} />
            <p className="text-sm text-muted-foreground">
              The average of each month&apos;s percentage miss. Every month counts the same. Months with <Tex tex="A_t = 0" /> are undefined, so the
              in-app engine excludes them and reports how many were excluded.
            </p>
          </div>
          <div className="card-surface space-y-2 p-5">
            <h3 className="font-semibold">Weighted Absolute Percentage Error</h3>
            <Tex block tex={String.raw`\text{WAPE} = 100\% \times \frac{\sum_{t}|A_t - F_t|}{\sum_{t}|A_t|}`} />
            <p className="text-sm text-muted-foreground">
              Total miss divided by total volume, so big months count more. Undefined when <Tex tex={String.raw`\sum_t |A_t| = 0`} />.{" "}
              <strong>WAPE is not the average of the monthly percentage errors.</strong>
            </p>
          </div>
        </div>
        <div className="card-surface space-y-2 p-5 text-sm">
          <h3 className="font-semibold">The difference, in plain words (with our numbers)</h3>
          <p>
            Imagine missing by 20 units in a 90-unit month and by 20 units in a 220-unit month. MAPE counts the first miss as 22% and the second as 9%; WAPE
            simply adds up 40 units of error against 310 units of demand. In Part 1, Naïve scores MAPE {part1.naive.mape.toFixed(2)}% but WAPE{" "}
            {part1.naive.wape.toFixed(2)}% (= {part1.naive.sum_abs_error} / {part1.naive.sum_demand}) because its biggest percentage misses happened in the
            small spring and winter months. Operations managers usually prefer WAPE because it tracks the volume of mis-planned stock.
          </p>
          <p className="text-muted-foreground">
            Also reported: RMSE = √(mean of squared errors), in the series&apos; units, and bias % = Σ(F − A) / ΣA × 100 (positive = over-forecasting).
          </p>
        </div>
      </Section>

      <Section id="validation" title="Validation design" notebookRef="1.9, 2.8, 2.10.2">
        <ul className="grid gap-3 text-sm md:grid-cols-3">
          <li className="card-surface p-4">
            <p className="font-semibold">Chronological split</p>
            <p className="mt-1 text-muted-foreground">
              Part 2 hides the last {part2.split.test.n} months ({part2.split.test.from} to {part2.split.test.to}); every model forecasts the whole block
              from the end of training. No shuffling: a random split would let a model see the future.
            </p>
          </li>
          <li className="card-surface p-4">
            <p className="font-semibold">Rolling origin</p>
            <p className="mt-1 text-muted-foreground">
              {part2.backtest.origins} origins × {part2.backtest.horizon} months = {part2.backtest.n_forecasts} forecasts. Each time the model is refitted on
              data up to the origin. Part 1 uses walk-forward one-step forecasts for Jul–Dec.
            </p>
          </li>
          <li className="card-surface p-4">
            <p className="font-semibold">No leakage</p>
            <p className="mt-1 text-muted-foreground">
              Features use only values before the forecast month. Models are chosen on out-of-sample WAPE, never on training error. Future dates are
              derived from the last observation, and models are refitted on all history before forecasting.
            </p>
          </li>
        </ul>
      </Section>

      <Section id="features" title="Task 1 features" notebookRef="2.6">
        <p className="text-sm text-muted-foreground">
          {part2.features.list.join(", ")}: lags 1, 2, 3 and 12; 3- and 12-month rolling means; and the month encoded as sin and cos so December and January
          stay neighbours.
        </p>
      </Section>

      <Section id="models" title="Models">
        <SimpleTable
          caption="Models and where they run"
          rows={MODELS}
          columns={[
            { key: "n", header: "Model", cell: (r) => r.name },
            { key: "f", header: "Family", cell: (r) => r.fam },
            { key: "h", header: "How it forecasts", cell: (r) => <span className="whitespace-normal">{r.how}</span>, className: "min-w-[280px]" },
            { key: "w", header: "Runs in", cell: (r) => r.where },
          ]}
        />
        <p className="text-xs text-muted-foreground">
          SARIMA, Random Forest and XGBoost run only in the notebook (Python); their results are reference-only. The in-app engine&apos;s Naïve, Seasonal
          Naïve and seasonal-index transfer reproduce the notebook&apos;s numbers exactly (unit-tested); Holt-Winters and ridge are independent TypeScript
          implementations, so their numbers differ from the notebook&apos;s and are always labelled &quot;In-app engine&quot;.
        </p>
      </Section>

      <Section id="legend" title="Data provenance legend">
        <ul className="grid gap-2 sm:grid-cols-2">
          {LEGEND.map((l) => (
            <li key={l.kind} className="flex items-start gap-3 rounded-lg border border-border bg-card p-3 text-sm">
              <ProvenanceBadge kind={l.kind} />
              <span className="text-muted-foreground">{l.text}</span>
            </li>
          ))}
        </ul>
      </Section>

      <Section id="sources" title="Data sources and licences">
        <SimpleTable
          caption="Data sources"
          rows={[
            { s: "FRED IPN31211N, Board of Governors of the Federal Reserve System", l: "Public domain, citation requested", u: "https://fred.stlouisfed.org/series/IPN31211N", t: "Proxy / live" },
            { s: "Open-Meteo Historical Weather API (ERA5), Dubai 2023", l: "CC BY 4.0, free non-commercial", u: "https://open-meteo.com/en/docs/historical-weather-api", t: "Real" },
            { s: "Open-Meteo Forecast + Archive APIs, 5 US metros + Dubai", l: "CC BY 4.0, free non-commercial", u: "https://open-meteo.com/", t: "Live" },
            { s: "Air-cooler demand, professor's reference Colab", l: "Course material", u: "", t: "Simulated" },
          ]}
          columns={[
            { key: "s", header: "Source", cell: (r) => <span className="whitespace-normal">{r.s}</span>, className: "min-w-[240px]" },
            { key: "t", header: "Label", cell: (r) => r.t },
            { key: "l", header: "Licence / terms", cell: (r) => r.l },
            { key: "u", header: "URL", cell: (r) => (r.u ? <a className="text-primary hover:underline" href={r.u} target="_blank" rel="noreferrer">{r.u.replace("https://", "")}</a> : "n/a") },
          ]}
        />
        <p className="text-xs text-muted-foreground">
          Reference results: <code className="font-mono break-all">{meta.notebook.file}</code> (SHA-256 {meta.notebook.notebook_sha256.slice(0, 16)}…), re-verified by{" "}
          <code className="font-mono">scripts/export_results.py</code> with {meta.export.assertions_passed} passing assertions. {meta.notebook.executed_with.part2}.
        </p>
      </Section>

      <Section id="limitations" title="Limitations">
        <ul className="list-disc space-y-1.5 pl-5 text-sm text-muted-foreground">
          <li>Part 1 demand is simulated teaching data; only six out-of-sample months are scored, so differences have wide uncertainty.</li>
          <li>Part 2 is a US category-level production index used as a proxy; a single brand would swing more and have higher errors than about 2%.</li>
          <li>Industrial-production data are revised; the live page shows any revision against the notebook&apos;s copy.</li>
          <li>The notebook&apos;s ML models use only the series&apos; own history; price, promotion and weather were not available historically for the proxy.</li>
          <li>At the 3-month horizon the gap between the best models is tenths of a percentage point; the ranking could change with new data.</li>
          <li>Intervals in the notebook exist for SARIMA only; in-app intervals are empirical (from backtest errors).</li>
          <li>LLM text can vary between runs; it is constrained to tool results but should be reviewed by an analyst.</li>
        </ul>
      </Section>

      <Section id="rdmu" title="Day 10 of RDMU (LLM integration reference)">
        <p className="text-sm text-muted-foreground">
          <strong>Not found.</strong> The slides refer to Day 10 of RDMU for LLM integration. No Day 10 RDMU material was found on this computer, so its
          contents are not assumed. The notebook follows the professor&apos;s reference Colab, which calls <code className="font-mono">google.colab.ai</code>
          ; this web app calls Google Gemini through the Vercel AI SDK with tool calling and a labelled rule-based fallback.
        </p>
      </Section>

      <Section id="references" title="References">
        <ol className="list-decimal space-y-1 pl-5 text-sm text-muted-foreground">
          <li>Course material: Session II Lab Activity and Exercise slides, AI in Operations, SP Jain School of Global Management.</li>
          <li>Professor&apos;s reference Google Colab notebook (air-cooler data; Naïve vs Random Forest; google.colab.ai).</li>
          <li>Board of Governors of the Federal Reserve System (US), Industrial Production: Soft Drink and Ice [IPN31211N], FRED, Federal Reserve Bank of St. Louis.</li>
          <li>Open-Meteo, Weather Forecast API and Historical Weather API, https://open-meteo.com/.</li>
          <li>Hyndman, R.J. &amp; Athanasopoulos, G. (2021). Forecasting: Principles and Practice, 3rd ed., OTexts.</li>
          <li>Box, G.E.P., Jenkins, G.M., Reinsel, G.C. &amp; Ljung, G.M. (2015). Time Series Analysis: Forecasting and Control, 5th ed.</li>
          <li>Cleveland, R.B. et al. (1990). STL: A seasonal-trend decomposition procedure based on Loess. Journal of Official Statistics, 6(1).</li>
          <li>Chen, T. &amp; Guestrin, C. (2016). XGBoost: A Scalable Tree Boosting System. KDD &apos;16.</li>
          <li>Breiman, L. (2001). Random Forests. Machine Learning, 45(1), 5–32.</li>
        </ol>
      </Section>
    </div>
  );
}
