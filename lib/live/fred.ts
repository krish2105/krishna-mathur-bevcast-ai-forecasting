import "server-only";
import { series } from "@/lib/data/reference";

export const FRED_CSV_URL = "https://fred.stlouisfed.org/graph/fredgraph.csv?id=IPN31211N";
export const LIVE_REVALIDATE_SECONDS = 21600; // 6 hours

export interface FredLive {
  ok: boolean;
  source: string;
  url: string;
  retrievedAt: string;
  latest?: { month: string; value: number };
  observations: { month: string; value: number }[];
  newSinceNotebook: { month: string; value: number }[];
  /** Largest absolute difference vs the notebook's copy over overlapping months (data revisions). */
  maxRevision?: { month: string; notebook: number; live: number; diff: number };
  error?: string;
}

/**
 * Latest observations of IPN31211N from FRED's public CSV endpoint. Sent as a plain request with no
 * browser-style headers on purpose: the endpoint can hang for browser-like or unusual User-Agents
 * (tested 12 Nov 2026). Cached for 6 hours (ISR) and capped by a 12 s timeout.
 */
export async function fetchFredLive(): Promise<FredLive> {
  const base = { source: "FRED (Federal Reserve Bank of St. Louis), series IPN31211N", url: FRED_CSV_URL };
  try {
    const res = await fetch(FRED_CSV_URL, {
      signal: AbortSignal.timeout(12_000),
      next: { revalidate: LIVE_REVALIDATE_SECONDS },
    });
    if (!res.ok) throw new Error(`FRED responded ${res.status}`);
    const text = await res.text();
    const rows = text
      .trim()
      .split(/\r?\n/)
      .slice(1)
      .map((line) => line.split(","))
      .filter(([d, v]) => /^\d{4}-\d{2}-\d{2}$/.test(d) && v !== "." && Number.isFinite(Number(v)))
      .map(([d, v]) => ({ month: d.slice(0, 7), value: Number(v) }));
    if (rows.length === 0) throw new Error("FRED returned no observations");
    const dateHeader = res.headers.get("date");
    const retrievedAt = dateHeader ? new Date(dateHeader).toISOString() : new Date().toISOString();
    const ref = new Map(series.fred_full_history.map((p) => [p.month, p.value]));
    const lastRef = series.fred_monthly.at(-1)!.month;
    let maxRevision: FredLive["maxRevision"];
    for (const r of rows.slice(-36)) {
      const nb = ref.get(r.month);
      if (nb === undefined) continue;
      const diff = Math.round((r.value - nb) * 10000) / 10000;
      if (!maxRevision || Math.abs(diff) > Math.abs(maxRevision.diff)) maxRevision = { month: r.month, notebook: nb, live: r.value, diff };
    }
    return {
      ...base,
      ok: true,
      retrievedAt,
      latest: rows.at(-1),
      observations: rows.slice(-24),
      newSinceNotebook: rows.filter((r) => r.month > lastRef),
      maxRevision,
    };
  } catch (e) {
    return { ...base, ok: false, retrievedAt: new Date().toISOString(), observations: [], newSinceNotebook: [], error: (e as Error).message };
  }
}
