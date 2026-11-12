import "server-only";
import { tool } from "ai";
import { z } from "zod";
import * as D from "@/lib/ai/data-tools";
import type { Source, UploadedPayload } from "@/lib/ai/schemas";

export interface ToolTrace {
  sources: Set<Source>;
  asOf: Map<string, string>;
  called: string[];
}

export function newTrace(): ToolTrace {
  return { sources: new Set(), asOf: new Map(), called: [] };
}

/**
 * The Copilot's tools. The set and order never change between requests (stable prompt prefix);
 * getUploadedDataResults reports "not available" when nothing was uploaded.
 */
export function buildTools(uploaded: UploadedPayload | null, trace: ToolTrace) {
  const ref = (name: string) => {
    trace.called.push(name);
    trace.sources.add("reference");
    trace.asOf.set("reference", D.REFERENCE_AS_OF);
  };
  return {
    getAssignmentBrief: tool({
      description: "The assignment slides (Part 1 lab, Part 2 exercise tasks 1–7, LLM requirement) and the compliance matrix.",
      inputSchema: z.object({}),
      execute: async () => {
        ref("getAssignmentBrief");
        return D.getAssignmentBrief();
      },
    }),
    getDatasetSummary: tool({
      description: "What data the app holds: Part 1 (simulated demand + real temperature), Part 2 (FRED proxy), and any user upload.",
      inputSchema: z.object({}),
      execute: async () => {
        ref("getDatasetSummary");
        if (uploaded) trace.sources.add("uploaded");
        return D.getDatasetSummary(uploaded);
      },
    }),
    getSalesHistory: tool({
      description: "Monthly history values for the reference FRED proxy series or the user's upload.",
      inputSchema: z.object({
        range: z.enum(["last12", "last24", "last36", "all"]).describe("How many recent months to return"),
        dataset: z.enum(["reference", "uploaded"]).default("reference"),
      }),
      execute: async ({ range, dataset }) => {
        if (dataset === "uploaded") {
          trace.called.push("getSalesHistory");
          trace.sources.add("uploaded");
        } else ref("getSalesHistory");
        return D.getSalesHistory(range, dataset, uploaded);
      },
    }),
    getSeasonality: tool({
      description: "Monthly seasonal index, STL trend/seasonal strength and how well each model captured the test-year seasonal shape (Part 2).",
      inputSchema: z.object({}),
      execute: async () => {
        ref("getSeasonality");
        return D.getSeasonality();
      },
    }),
    getModelLeaderboard: tool({
      description:
        "Model scores. Part 2: 'holdout' (12-month test Oct 2025–Sep 2026) or 'backtest' (18-origin 3-month rolling). Part 1: 'walk_forward' (Jul–Dec, honest) or 'in_sample' (misleading fit score).",
      inputSchema: z.object({
        part: z.union([z.literal(1), z.literal(2)]),
        evaluation: z.enum(["holdout", "backtest", "walk_forward", "in_sample"]),
      }),
      execute: async ({ part, evaluation }) => {
        ref("getModelLeaderboard");
        return D.getModelLeaderboard(part, evaluation);
      },
    }),
    getForecast: tool({
      description: "The next-3-month FUTURE forecast for Part 2 (default: the selected model), with SARIMA 80%/95% intervals and all models' forecasts.",
      inputSchema: z.object({
        model: z.enum(["Naïve", "Seasonal Naïve", "SARIMA", "Holt-Winters", "Random Forest", "XGBoost"]).optional(),
      }),
      execute: async ({ model }) => {
        ref("getForecast");
        return D.getForecast(model);
      },
    }),
    getMetrics: tool({
      description: "MAPE, WAPE, RMSE and bias for one named model (Part 2 hold-out and backtest, or Part 1 walk-forward).",
      inputSchema: z.object({ model: z.string().max(80) }),
      execute: async ({ model }) => {
        ref("getMetrics");
        return D.getMetrics(model);
      },
    }),
    getFirstYearScenario: tool({
      description: "What the new product can achieve with only 12 months of history (seasonal-index transfer vs Random Forest vs Naïve).",
      inputSchema: z.object({}),
      execute: async () => {
        ref("getFirstYearScenario");
        return D.getFirstYearScenario();
      },
    }),
    getPart1Results: tool({
      description: "All Part 1 air-cooler results: Naïve, in-sample vs walk-forward Random Forest, weather-adjusted model, stockout vs excess units.",
      inputSchema: z.object({}),
      execute: async () => {
        ref("getPart1Results");
        return D.getPart1Results();
      },
    }),
    getLiveSignals: tool({
      description: "LIVE data fetched now: latest FRED IPN31211N observations (new releases, revisions) and the 16-day Open-Meteo temperature outlook vs the same dates last year.",
      inputSchema: z.object({}),
      execute: async () => {
        trace.called.push("getLiveSignals");
        trace.sources.add("live");
        const live = await D.getLiveSignals();
        if ("retrievedAt" in live.fred) trace.asOf.set("FRED live", live.fred.retrievedAt);
        if ("retrievedAt" in live.weather) trace.asOf.set("Open-Meteo live", live.weather.retrievedAt);
        return live;
      },
    }),
    getUploadedDataResults: tool({
      description: "Evaluate the user's uploaded monthly data with the in-app engine (hold-out, backtest, next 3 months). Returns available=false if nothing was uploaded.",
      inputSchema: z.object({}),
      execute: async () => {
        trace.called.push("getUploadedDataResults");
        if (uploaded) {
          trace.sources.add("uploaded");
          trace.asOf.set("upload", uploaded.uploadedAt);
        }
        return D.getUploadedDataResults(uploaded);
      },
    }),
  };
}

export type CopilotTools = ReturnType<typeof buildTools>;
