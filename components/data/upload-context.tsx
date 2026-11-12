"use client";

/**
 * The user's uploaded dataset lives only in this browser tab (React state mirrored to sessionStorage).
 * It is never written to the server; the Copilot receives only the aggregated monthly values (<= 240).
 */
import * as React from "react";
import type { QualityReport } from "@/lib/data/csv";

export interface UploadedSeries {
  fileName: string;
  label: string;
  months: string[];
  values: number[];
  uploadedAt: string;
  imputedMonths: string[];
  warnings: string[];
  report: Pick<QualityReport, "rowsRead" | "rowsUsed" | "monthsWithSeveralRows" | "negativeValues" | "missingMonths">;
}

interface Ctx {
  upload: UploadedSeries | null;
  setUpload: (u: UploadedSeries | null) => void;
  ready: boolean;
}

const KEY = "bevcast.upload.v1";
const UploadContext = React.createContext<Ctx>({ upload: null, setUpload: () => {}, ready: false });

export function UploadProvider({ children }: { children: React.ReactNode }) {
  const [upload, setUploadState] = React.useState<UploadedSeries | null>(null);
  const [ready, setReady] = React.useState(false);

  React.useEffect(() => {
    try {
      const raw = window.sessionStorage.getItem(KEY);
      // eslint-disable-next-line react-hooks/set-state-in-effect -- hydrate from this tab's session after mount
      if (raw) setUploadState(JSON.parse(raw) as UploadedSeries);
    } catch {
      /* storage unavailable or corrupt: start empty */
    }
    setReady(true);
  }, []);

  const setUpload = React.useCallback((u: UploadedSeries | null) => {
    setUploadState(u);
    try {
      if (u) window.sessionStorage.setItem(KEY, JSON.stringify(u));
      else window.sessionStorage.removeItem(KEY);
    } catch {
      /* ignore: data still lives in memory for this page view */
    }
  }, []);

  const value = React.useMemo(() => ({ upload, setUpload, ready }), [upload, setUpload, ready]);
  return <UploadContext.Provider value={value}>{children}</UploadContext.Provider>;
}

export function useUpload() {
  return React.useContext(UploadContext);
}
