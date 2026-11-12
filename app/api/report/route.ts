import { z } from "zod";
import { part1, part2, series } from "@/lib/data/reference";
import { toCsv } from "@/lib/format";

const Type = z.enum(["forecasts", "metrics", "leaderboard", "backtest", "part1"]);

function build(type: z.infer<typeof Type>) {
  switch (type) {
    case "forecasts":
      return part2.future.rows.map((r) => ({
        month: r.month,
        ...Object.fromEntries(part2.models.map((m) => [m, r[m] as number])),
        sarima_80_low: r.sarima_pi80[0],
        sarima_80_high: r.sarima_pi80[1],
        sarima_95_low: r.sarima_pi95[0],
        sarima_95_high: r.sarima_pi95[1],
        selected_model: part2.best_model,
        source: "Reference (notebook); FRED IPN31211N category proxy",
      }));
    case "metrics":
      return [
        ...part2.holdout.scores.map((s) => ({ evaluation: "hold-out 12 months (Oct 2025 - Sep 2026)", ...s })),
        ...part2.backtest.scores.map((s) => ({ evaluation: "rolling backtest 18 origins x 3 months", ...s })),
      ];
    case "leaderboard":
      return part2.backtest.scores.map((s, i) => {
        const h = part2.holdout.scores.find((x) => x.model === s.model)!;
        return {
          rank_by_backtest_wape: i + 1,
          model: s.model,
          backtest_mape: s.mape,
          backtest_wape: s.wape,
          holdout_mape: h.mape,
          holdout_wape: h.wape,
          holdout_wape_improvement_vs_naive_pct: h.wape_improvement_vs_naive_pct,
          selected: s.model === part2.best_model ? "yes" : "",
        };
      });
    case "backtest":
      return series.backtest_detail;
    case "part1":
      return [
        ...part1.walk_forward.scores.map((s) => ({ evaluation: "walk-forward Jul-Dec 2023", model: s.model, mape: s.mape, wape: s.wape })),
        ...part1.in_sample.scores.map((s) => ({ evaluation: "in-sample Mar-Dec 2023 (fit, misleading)", model: s.model, mape: s.mape, wape: s.wape })),
        { evaluation: "naive Feb-Dec 2023", model: "Naïve", mape: part1.naive.mape, wape: part1.naive.wape },
      ];
  }
}

export function GET(req: Request) {
  const parsed = Type.safeParse(new URL(req.url).searchParams.get("type"));
  if (!parsed.success) {
    return Response.json({ error: "Unknown report type. Use forecasts, metrics, leaderboard, backtest or part1." }, { status: 400 });
  }
  const csv = toCsv(build(parsed.data) as Record<string, string | number>[]);
  return new Response(`﻿${csv}\n`, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="bevcast-${parsed.data}.csv"`,
      "Cache-Control": "public, max-age=3600",
    },
  });
}
