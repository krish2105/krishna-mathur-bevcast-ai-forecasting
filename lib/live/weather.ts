import "server-only";
import { LIVE_REVALIDATE_SECONDS } from "@/lib/live/fred";

export const CITIES = [
  { name: "New York", lat: 40.71, lon: -74.01, us: true },
  { name: "Los Angeles", lat: 34.05, lon: -118.24, us: true },
  { name: "Chicago", lat: 41.88, lon: -87.63, us: true },
  { name: "Houston", lat: 29.76, lon: -95.37, us: true },
  { name: "Atlanta", lat: 33.75, lon: -84.39, us: true },
  { name: "Dubai", lat: 25.2, lon: 55.27, us: false },
] as const;

export interface CityWeather {
  city: string;
  us: boolean;
  window: string;
  forecastAvgMax: number;
  lastYearAvgMax: number;
  diff: number;
  daily: { date: string; forecast: number | null; lastYear: number | null }[];
}

export interface WeatherLive {
  ok: boolean;
  source: string;
  retrievedAt: string;
  window?: { from: string; to: string };
  cities: CityWeather[];
  usSummary?: { forecastAvgMax: number; lastYearAvgMax: number; diff: number; warmer: number; cooler: number };
  error?: string;
}

interface DailyBlock {
  daily: { time: string[]; temperature_2m_max: (number | null)[] };
}

const mean = (xs: (number | null)[]) => {
  const v = xs.filter((x): x is number => typeof x === "number");
  return v.length ? v.reduce((a, b) => a + b, 0) / v.length : NaN;
};
const r1 = (x: number) => Math.round(x * 10) / 10;

function shiftYear(iso: string, days = -365): string {
  const d = new Date(`${iso}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

async function getJson<T>(url: string): Promise<T> {
  const res = await fetch(url, {
    signal: AbortSignal.timeout(12_000),
    next: { revalidate: LIVE_REVALIDATE_SECONDS },
  });
  if (!res.ok) throw new Error(`Open-Meteo responded ${res.status}`);
  return (await res.json()) as T;
}

/**
 * Live 16-day maximum-temperature outlook vs the same dates last year (Open-Meteo forecast + archive APIs),
 * for the five US metros used in the notebook plus Dubai (Part 1 context). Same method as notebook §2.13.
 */
export async function fetchWeatherLive(): Promise<WeatherLive> {
  const source = "Open-Meteo Forecast API (16-day) and Historical Weather API (same dates last year)";
  try {
    const lat = CITIES.map((c) => c.lat).join(",");
    const lon = CITIES.map((c) => c.lon).join(",");
    const fc = await getJson<DailyBlock[]>(
      `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&daily=temperature_2m_max&forecast_days=16&timezone=auto`,
    );
    const days = fc[0].daily.time;
    const from = days[0];
    const to = days[days.length - 1];
    const ly = await getJson<DailyBlock[]>(
      `https://archive-api.open-meteo.com/v1/archive?latitude=${lat}&longitude=${lon}&start_date=${shiftYear(from)}&end_date=${shiftYear(
        to,
      )}&daily=temperature_2m_max&timezone=auto`,
    );
    const cities: CityWeather[] = CITIES.map((c, i) => {
      const f = fc[i].daily;
      const l = ly[i].daily;
      const fAvg = mean(f.temperature_2m_max);
      const lAvg = mean(l.temperature_2m_max);
      return {
        city: c.name,
        us: c.us,
        window: `${f.time[0]} to ${f.time[f.time.length - 1]}`,
        forecastAvgMax: r1(fAvg),
        lastYearAvgMax: r1(lAvg),
        diff: r1(fAvg - lAvg),
        daily: f.time.map((d, j) => ({ date: d, forecast: f.temperature_2m_max[j], lastYear: l.temperature_2m_max[j] ?? null })),
      };
    });
    const us = cities.filter((c) => c.us);
    const usF = us.reduce((a, c) => a + c.forecastAvgMax, 0) / us.length;
    const usL = us.reduce((a, c) => a + c.lastYearAvgMax, 0) / us.length;
    return {
      ok: true,
      source,
      retrievedAt: new Date().toISOString(),
      window: { from, to },
      cities,
      usSummary: {
        forecastAvgMax: r1(usF),
        lastYearAvgMax: r1(usL),
        diff: r1(usF - usL),
        warmer: us.filter((c) => c.diff > 0).length,
        cooler: us.filter((c) => c.diff < 0).length,
      },
    };
  } catch (e) {
    return { ok: false, source, retrievedAt: new Date().toISOString(), cities: [], error: (e as Error).message };
  }
}
