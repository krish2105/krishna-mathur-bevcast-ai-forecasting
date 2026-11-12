import type { Metadata } from "next";
import Link from "next/link";
import { ArrowDownRight, ArrowUpRight, Bot, ExternalLink, Minus, TriangleAlert } from "lucide-react";
import { SignedColumns } from "@/components/charts/bar-charts";
import { ChartCard } from "@/components/charts/chart-card";
import { TimeSeriesChart } from "@/components/charts/time-series-chart";
import { KpiCard } from "@/components/common/kpi-card";
import { PageHeader, Section } from "@/components/common/page-header";
import { ProvenanceBadge } from "@/components/common/provenance-badge";
import { SimpleTable } from "@/components/common/simple-table";
import { Button } from "@/components/ui/button";
import { series } from "@/lib/data/reference";
import { monthLabel } from "@/lib/format";
import { FRED_CSV_URL, fetchFredLive } from "@/lib/live/fred";
import { fetchWeatherLive } from "@/lib/live/weather";

export const metadata: Metadata = {
  title: "Real-Time Signals",
  description: "Live FRED IPN31211N observations and the Open-Meteo 16-day temperature outlook vs the same dates last year.",
};

export const revalidate = 21600; // 6 h ISR: live feeds are re-fetched at most every 6 hours

const CITY_CODE: Record<string, string> = { "New York": "NYC", "Los Angeles": "LA", Chicago: "CHI", Houston: "HOU", Atlanta: "ATL", Dubai: "DXB" };

function utc(iso: string) {
  return `${new Date(iso).toISOString().slice(0, 16).replace("T", " ")} UTC`;
}

function Freshness({ iso }: { iso: string }) {
  return (
    <span className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
      <span className="live-dot size-1.5 rounded-full bg-primary" aria-hidden />
      Retrieved {utc(iso)} · refreshed at most every 6 hours
    </span>
  );
}

export default async function LivePage() {
  const [fred, weather] = await Promise.all([fetchFredLive(), fetchWeatherLive()]);
  const nb = new Map(series.fred_full_history.map((p) => [p.month, p.value]));
  const fredRows = fred.observations.map((o) => ({ month: o.month, Live: o.value, Notebook: nb.get(o.month) ?? null }));
  const us = weather.usSummary;
  const prompt = encodeURIComponent("How does this week's weather outlook affect demand?");

  return (
    <div className="space-y-10" data-testid="page-live">
      <PageHeader
        eyebrow="Real-time data for the LLM interpretation"
        title="Real-time signals"
        description="Fetched on the server from public APIs at request time (cached for up to 6 hours) and passed to the Copilot through its getLiveSignals tool. Weather is a qualitative signal; it is not an input of the Part 2 models."
        badges={<ProvenanceBadge kind="live" />}
        actions={
          <Button asChild>
            <Link href={`/copilot?prompt=${prompt}`} data-testid="send-to-copilot">
              <Bot /> Send to Copilot
            </Link>
          </Button>
        }
      />

      <div className="grid auto-rows-fr grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <KpiCard
          label="FRED latest observation"
          value={fred.latest ? fred.latest.value.toFixed(2) : "n/a"}
          unit={fred.latest ? "index" : undefined}
          sub={fred.latest ? monthLabel(fred.latest.month) : fred.error}
          badge={<ProvenanceBadge kind="live" />}
        />
        <KpiCard
          label="New months since the notebook run"
          value={fred.ok ? String(fred.newSinceNotebook.length) : "n/a"}
          sub={fred.ok ? `Notebook data end: ${monthLabel(series.fred_monthly.at(-1)!.month)}` : "Feed unavailable"}
        />
        <KpiCard
          label="Largest revision vs notebook copy"
          value={fred.maxRevision ? fred.maxRevision.diff.toFixed(2) : fred.ok ? "0.00" : "n/a"}
          unit={fred.ok ? "index pts" : undefined}
          sub={
            fred.maxRevision && fred.maxRevision.diff !== 0
              ? `${monthLabel(fred.maxRevision.month)} (last 36 months checked)`
              : fred.ok
                ? "No revisions in the last 36 months"
                : "Feed unavailable"
          }
        />
        <KpiCard
          label="16-day outlook vs last year (5 US metros)"
          value={us ? `${us.diff > 0 ? "+" : ""}${us.diff.toFixed(1)}` : "n/a"}
          unit={us ? "°C" : undefined}
          sub={us ? `${us.forecastAvgMax.toFixed(1)} °C vs ${us.lastYearAvgMax.toFixed(1)} °C · ${us.warmer} warmer, ${us.cooler} cooler` : weather.error}
          delta={
            us
              ? {
                  text: Math.abs(us.diff) < 1 ? "Close to last year" : us.diff > 0 ? "Warmer: upside risk" : "Cooler: downside risk",
                  tone: "neutral",
                  direction: Math.abs(us.diff) < 1 ? "flat" : us.diff > 0 ? "up" : "down",
                }
              : undefined
          }
          badge={<ProvenanceBadge kind="live" />}
        />
      </div>

      <Section id="fred" title="FRED IPN31211N: latest release" description="The same series the notebook used, downloaded now. The overlay shows whether the Federal Reserve has revised recent values since the notebook run.">
        {fred.ok ? (
          <ChartCard
            testId="chart-live-fred"
            title="Last 24 months: live download vs the notebook's copy"
            description={<Freshness iso={fred.retrievedAt} />}
            badges={<ProvenanceBadge kind="live" />}
            data={fredRows}
            fileName="fred-live"
            footer={
              <a href={FRED_CSV_URL} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-primary hover:underline">
                fredgraph.csv?id=IPN31211N <ExternalLink className="size-3" aria-hidden />
              </a>
            }
          >
            <TimeSeriesChart
              data={fredRows}
              yLabel="Index (2017 = 100)"
              height={280}
              series={[
                { key: "Live", name: "Live (now)", style: "Actual", dots: true },
                { key: "Notebook", name: "Notebook copy", style: "Holt-Winters" },
              ]}
            />
          </ChartCard>
        ) : (
          <div role="alert" className="card-surface flex items-start gap-2 p-5 text-sm text-critical-fg">
            <TriangleAlert className="mt-0.5 size-4" aria-hidden /> FRED live feed unavailable ({fred.error}). The reference results are unaffected.
          </div>
        )}
      </Section>

      <Section
        id="weather"
        title="Weather outlook: next 16 days vs the same dates last year"
        description={`Average daily maximum temperature. Same method as notebook §2.13 for New York, Los Angeles, Chicago, Houston and Atlanta, plus Dubai for the Part 1 air-cooler context${weather.window ? ` (${weather.window.from} to ${weather.window.to})` : ""}.`}
      >
        {weather.ok ? (
          <div className="grid gap-4 xl:grid-cols-[1fr_1fr]">
            <ChartCard
              testId="chart-live-weather"
              title="Difference vs the same dates last year (°C)"
              description={<Freshness iso={weather.retrievedAt} />}
              badges={<ProvenanceBadge kind="live" />}
              data={weather.cities.map((c) => ({ city: c.city, forecast_avg_max_c: c.forecastAvgMax, last_year_avg_max_c: c.lastYearAvgMax, diff_c: c.diff }))}
              fileName="weather-live"
            >
              <SignedColumns
                data={weather.cities.map((c) => ({ city: CITY_CODE[c.city] ?? c.city, diff: c.diff }))}
                valueKey="diff"
                nameKey="city"
                yLabel="Difference (°C)"
                unit={"\u00a0°C"}
                digits={1}
                positiveColor="var(--m-sarima)"
                negativeColor="var(--m-hw)"
              />
            </ChartCard>
            <SimpleTable
              testId="weather-table"
              caption="16-day outlook by city"
              rows={weather.cities}
              columns={[
                { key: "c", header: "City", cell: (r) => (r.us ? r.city : `${r.city} (Part 1)`) },
                { key: "f", header: "Forecast avg max", numeric: true, cell: (r) => `${r.forecastAvgMax.toFixed(1)} °C` },
                { key: "l", header: "Same dates last year", numeric: true, cell: (r) => `${r.lastYearAvgMax.toFixed(1)} °C` },
                {
                  key: "d",
                  header: "Difference",
                  numeric: true,
                  cell: (r) => (
                    <span className="inline-flex items-center gap-1">
                      {r.diff > 0 ? <ArrowUpRight className="size-3" aria-label="warmer" /> : r.diff < 0 ? <ArrowDownRight className="size-3" aria-label="cooler" /> : <Minus className="size-3" />}
                      {r.diff > 0 ? "+" : ""}
                      {r.diff.toFixed(1)} °C
                    </span>
                  ),
                },
              ]}
            />
          </div>
        ) : (
          <div role="alert" className="card-surface flex items-start gap-2 p-5 text-sm text-critical-fg">
            <TriangleAlert className="mt-0.5 size-4" aria-hidden /> Weather feed unavailable ({weather.error}).
          </div>
        )}
        <p className="text-xs text-muted-foreground">
          Weather data by Open-Meteo.com (CC BY 4.0). FRED data: Board of Governors of the Federal Reserve System (US), retrieved from FRED, Federal Reserve
          Bank of St. Louis. This page is regenerated at most every 6 hours.
        </p>
      </Section>
    </div>
  );
}
