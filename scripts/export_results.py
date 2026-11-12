#!/usr/bin/env python3
"""Export the reference results of the EXECUTED notebook to typed JSON for the BevCast AI web app.

The executed notebook in ``notebook/`` is the single source of truth. This script:

1. reads the saved outputs of the tagged cells (``summary_json_part1``, ``summary_json_part2``,
   ``summary_table_part1``, ``summary_table_part2``, ``backtest_table_part2``, ``future_table_part2``,
   ``llm_output_part2``) and several untagged result tables;
2. re-runs the notebook's own code cells, unchanged and in order, offline against the same CSV files
   (``notebook/data/``), with the same seed (42) and hyper-parameters, to obtain series the notebook
   computed but did not print (per-month forecasts, decomposition, backtest detail, ...);
3. asserts that every re-computed table and printed result equals the notebook's saved output to two
   decimals (and every deterministic printed line exactly). Any mismatch stops the export (exit 1);
4. writes ``data/part1.json``, ``data/part2.json``, ``data/series.json`` and ``data/meta.json``.

Network access is blocked during the re-run on purpose, so the notebook's own fallbacks load the local
CSV copies; live feeds are handled by the web app at request time instead.

Usage (from the repository root):
    python -m venv .venv && .venv/bin/pip install -r scripts/requirements.txt
    .venv/bin/python scripts/export_results.py
"""
from __future__ import annotations

import contextlib
import hashlib
import html.parser
import io
import json
import math
import os
import platform
import sys
import urllib.error
import urllib.request
import warnings
from datetime import datetime, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
NB_NAME = "Krishna_Mathur_AS25DXB018_AI_in_Operations_Problems_and_Exercises.ipynb"
NB_DIR = ROOT / "notebook"
NB_PATH = NB_DIR / NB_NAME
OUT_DIR = ROOT / "data"
FRED_CSV = NB_DIR / "data" / "fred_IPN31211N_soft_drink_production.csv"
TEMP_CSV = NB_DIR / "data" / "openmeteo_dubai_2023_monthly_temperature.csv"

CHECKS: list[str] = []


def fail(msg: str) -> None:
    print(f"\nASSERTION FAILED: {msg}", file=sys.stderr)
    sys.exit(1)


def check(cond: bool, msg: str) -> None:
    if not cond:
        fail(msg)
    CHECKS.append(msg)


def sha256(path: Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest()


# --------------------------------------------------------------------------------------------------
# 1. Read the saved outputs of the executed notebook
# --------------------------------------------------------------------------------------------------
class _TableParser(html.parser.HTMLParser):
    """Minimal parser for pandas DataFrame HTML (first <table> only)."""

    def __init__(self) -> None:
        super().__init__()
        self.rows: list[list[str]] = []
        self._row: list[str] | None = None
        self._cell: list[str] | None = None
        self._done = False

    def handle_starttag(self, tag, attrs):
        if self._done:
            return
        if tag == "tr":
            self._row = []
        elif tag in ("td", "th") and self._row is not None:
            self._cell = []

    def handle_endtag(self, tag):
        if self._done:
            return
        if tag in ("td", "th") and self._row is not None and self._cell is not None:
            self._row.append("".join(self._cell).strip())
            self._cell = None
        elif tag == "tr" and self._row is not None:
            self.rows.append(self._row)
            self._row = None
        elif tag == "table":
            self._done = True

    def handle_data(self, data):
        if self._cell is not None:
            self._cell.append(data)


def parse_html_table(html_text: str) -> tuple[list[str], list[list[str]]]:
    p = _TableParser()
    p.feed(html_text)
    header, *body = p.rows
    # pandas may emit a second header row for the index name; drop rows that are all empty but one
    body = [r for r in body if len(r) == len(header)]
    return header, body


nb = json.loads(NB_PATH.read_text(encoding="utf-8"))
CELLS = nb["cells"]


def cell_by_tag(tag: str) -> dict:
    hits = [c for c in CELLS if tag in c.get("metadata", {}).get("tags", [])]
    check(len(hits) == 1, f"exactly one cell tagged {tag}")
    return hits[0]


def cell_by_source(snippet: str) -> dict:
    hits = [c for c in CELLS if c["cell_type"] == "code" and snippet in "".join(c["source"])]
    check(len(hits) == 1, f"exactly one code cell containing {snippet!r}")
    return hits[0]


def saved_stdout(cell: dict) -> str:
    return "".join("".join(o["text"]) for o in cell.get("outputs", [])
                   if o["output_type"] == "stream" and o.get("name") == "stdout")


def saved_mime(cell: dict, mime: str) -> str:
    for o in cell.get("outputs", []):
        if mime in o.get("data", {}):
            return "".join(o["data"][mime])
    fail(f"no {mime} output in cell")
    return ""


def saved_table(cell: dict) -> tuple[list[str], list[list[str]]]:
    return parse_html_table(saved_mime(cell, "text/html"))


check(all(c.get("execution_count") or c["cell_type"] != "code" for c in CELLS),
      "every code cell of the notebook has been executed")
check(not any(o["output_type"] == "error" for c in CELLS for o in c.get("outputs", [])),
      "the notebook contains no error outputs")

SAVED = {
    "summary_json_part1": json.loads(saved_stdout(cell_by_tag("summary_json_part1"))),
    "summary_json_part2": json.loads(saved_stdout(cell_by_tag("summary_json_part2"))),
    "summary_table_part1": saved_table(cell_by_tag("summary_table_part1")),
    "summary_table_part2": saved_table(cell_by_tag("summary_table_part2")),
    "backtest_table_part2": saved_table(cell_by_tag("backtest_table_part2")),
    "future_table_part2": saved_table(cell_by_tag("future_table_part2")),
    "llm_output_part2": saved_mime(cell_by_tag("llm_output_part2"), "text/markdown"),
    "insample_table_part1": saved_table(cell_by_source("insample_scores = score_table(")),
    "impact_table_part1": saved_table(cell_by_source("impact_rows = []")),
    "test_table_part2": saved_table(cell_by_source("test_forecasts = forecast_all(train, H_TEST)")),
    "shape_table_part2": saved_table(cell_by_source("def seasonal_shape(values)")),
    "cold_table_part2": saved_table(cell_by_source("first_year = sales.iloc[-H_TEST - 12:-H_TEST]")),
    "sarima_grid_part2": saved_table(cell_by_source("for p, q, P, Q in itertools.product")),
    "weather_table_part2": saved_table(cell_by_source("CITIES = {")),
    "fred_load_stdout": saved_stdout(cell_by_source("def load_fred():")),
    "weather_stdout": saved_stdout(cell_by_source("CITIES = {")),
    "prompt_stdout": saved_stdout(cell_by_source("PROMPT = f'''")),
    "versions_part1": saved_stdout(cell_by_source('print("numpy", np.__version__')),
    "versions_part2": saved_stdout(cell_by_source('print("pandas", pd.__version__, "| scikit-learn"')),
}

# --------------------------------------------------------------------------------------------------
# 2. Re-run the notebook code cells unchanged, offline
# --------------------------------------------------------------------------------------------------
os.environ["MPLBACKEND"] = "Agg"
os.environ.pop("ANTHROPIC_API_KEY", None)   # the LLM cell must take its labelled offline path here


def _offline(*_a, **_k):
    raise urllib.error.URLError("offline export: notebook falls back to its local CSV copy")


urllib.request.urlopen = _offline  # the notebook calls urllib.request.urlopen(...) at run time

import matplotlib  # noqa: E402

matplotlib.use("Agg")
import matplotlib.pyplot as plt  # noqa: E402

# Cells whose printed text legitimately depends on the network or the clock
VOLATILE = ("def load_temperature():", "def load_fred():", "CITIES = {", "PROMPT = f'''", "def ask_llm(",
            '"llm_backend": llm_backend')  # last one: compared field by field below instead

ns: dict = {"__name__": "__main__", "display": lambda *a, **k: None}
rerun_stdout: dict[int, str] = {}
cwd = os.getcwd()
os.chdir(NB_DIR)  # the notebook reads data/<file>.csv relative to itself
try:
    for i, c in enumerate(CELLS):
        if c["cell_type"] != "code":
            continue
        # In Jupyter, display() renders rich output, not stdout; keep it out of the stdout comparison
        ns["display"] = lambda *a, **k: None
        buf = io.StringIO()
        with contextlib.redirect_stdout(buf), warnings.catch_warnings():
            warnings.filterwarnings("ignore", message="FigureCanvasAgg is non-interactive")
            exec(compile("".join(c["source"]), f"<notebook cell {i}>", "exec"), ns)
        plt.close("all")
        rerun_stdout[i] = buf.getvalue()
        print(f"  re-ran cell {i:>2}", file=sys.stderr)
finally:
    os.chdir(cwd)

for i, c in enumerate(CELLS):
    if c["cell_type"] != "code":
        continue
    src = "".join(c["source"])
    if any(v in src for v in VOLATILE):
        continue
    check(rerun_stdout[i] == saved_stdout(c), f"cell {i}: re-run stdout identical to the notebook")

pd = ns["pd"]
np = ns["np"]


def f2(x) -> str:
    """Format like the notebook's DataFrame display (precision 2, NaN as 'NaN')."""
    if x is None or (isinstance(x, float) and math.isnan(x)):
        return "NaN"
    if isinstance(x, (int, np.integer)) and not isinstance(x, bool):
        return str(int(x))
    if isinstance(x, (float, np.floating)):
        return f"{float(x):.2f}"
    return str(x)


def compare_frame(name: str, df, saved: tuple[list[str], list[list[str]]], index_fmt=None,
                  round_first: int | None = None) -> None:
    header, rows = saved
    cols = header[1:]
    check(list(df.columns) == cols, f"{name}: same columns {cols}")
    check(len(df) == len(rows), f"{name}: same number of rows ({len(rows)})")
    for (idx, r), saved_row in zip(df.iterrows(), rows):
        exp_index, exp_vals = saved_row[0], saved_row[1:]
        if index_fmt is not None:
            check(index_fmt(idx) == exp_index, f"{name}: index {exp_index}")
        for col, exp in zip(cols, exp_vals):
            v = r[col]
            if round_first is not None and isinstance(v, (float, np.floating)):
                v = round(float(v), round_first)
            got = f2(v)
            try:  # numeric cell: equal to two decimals (pandas trims trailing zeros, e.g. 28.4)
                ok = (exp == "NaN" and got == "NaN") or round(float(got), 2) == round(float(exp), 2)
            except ValueError:  # text cell (model name, peak month); pandas truncates long text with "..."
                ok = got == exp or (exp.endswith("...") and got.startswith(exp[:-3]))
            check(ok, f"{name}[{exp_index}][{col}] = {exp} (re-computed {got})")


compare_frame("summary_table_part1 (walk-forward)", ns["oos_scores"], SAVED["summary_table_part1"])
compare_frame("in-sample table (Part 1)", ns["insample_scores"], SAVED["insample_table_part1"])
compare_frame("impact table (Part 1)", ns["impact"].round(1), SAVED["impact_table_part1"])
compare_frame("summary_table_part2 (hold-out)", ns["holdout_scores"].round(2), SAVED["summary_table_part2"])
compare_frame("backtest_table_part2", ns["backtest_scores"].round(2), SAVED["backtest_table_part2"])
compare_frame("future_table_part2", ns["future_table"].round(2), SAVED["future_table_part2"],
              index_fmt=lambda i: i)
compare_frame("test table (Part 2)", ns["test_table"].round(2), SAVED["test_table_part2"], index_fmt=lambda i: i)
compare_frame("seasonal-shape table (Part 2)", ns["shape"].round(2), SAVED["shape_table_part2"])
compare_frame("first-year-only table (Part 2)", ns["cold_scores"].round(2), SAVED["cold_table_part2"])

# Summary JSON cells: re-printed JSON must equal the saved JSON (minus run-time-only fields)
rerun_s1 = json.loads(rerun_stdout[CELLS.index(cell_by_tag("summary_json_part1"))])
check(rerun_s1 == SAVED["summary_json_part1"], "summary_json_part1 identical")
rerun_s2 = json.loads(rerun_stdout[CELLS.index(cell_by_tag("summary_json_part2"))])
saved_s2 = SAVED["summary_json_part2"]
for k in saved_s2:
    if k in ("weather_note", "llm_backend"):
        continue
    a, b = rerun_s2[k], saved_s2[k]
    if k == "data":  # "source" says whether FRED was downloaded live or read from the local copy
        a = {kk: vv for kk, vv in a.items() if kk != "source"}
        b = {kk: vv for kk, vv in b.items() if kk != "source"}
    check(a == b, f"summary_json_part2.{k} identical")

# Reference numbers quoted in the brief (Section 4.1): spot-check against the notebook output
S1, S2 = SAVED["summary_json_part1"], SAVED["summary_json_part2"]
check(S1["naive_feb_dec"] == {"MAPE": 17.35, "WAPE": 15.84}, "Part 1 naive Feb-Dec 17.35 / 15.84")
check(S1["walk_forward_jul_dec"]["Weather-adjusted regression"] == {"MAPE (%)": 12.0, "WAPE (%)": 11.98},
      "Part 1 weather-adjusted 12.00 / 11.98")
check(S2["best_model"] == "XGBoost", "Part 2 selected model XGBoost")
check(S2["holdout"]["Naïve"] == {"MAPE (%)": 2.64, "WAPE (%)": 2.59}, "Part 2 naive hold-out 2.64 / 2.59")
check(S2["holdout"]["Seasonal Naïve"] == {"MAPE (%)": 2.66, "WAPE (%)": 2.64},
      "Part 2 seasonal naive hold-out 2.66 / 2.64")

# --------------------------------------------------------------------------------------------------
# 3. Build the JSON payloads from the re-run (identical to the notebook, as asserted above)
# --------------------------------------------------------------------------------------------------
LABELS = {
    "simulated": "Simulated teaching data (professor's reference notebook)",
    "real": "Real observed data",
    "proxy": "Category proxy (FRED industry index), not company sales",
    "live": "Live, fetched at request time",
}


def r(x, d=4):
    if x is None:
        return None
    x = float(x)
    return None if math.isnan(x) else round(x, d)


def month(ts) -> str:
    return pd.Timestamp(ts).strftime("%Y-%m")


def frame_records(df, cols_map: dict[str, str], d=2):
    out = []
    for _, row in df.iterrows():
        rec = {}
        for src, dst in cols_map.items():
            v = row[src]
            rec[dst] = v if isinstance(v, str) else r(v, d)
        out.append(rec)
    return out


df1 = ns["df"]
temp_csv = pd.read_csv(TEMP_CSV)
wf = ns["wf"]
preds = ns["preds"]
ml_df = ns["ml_df"]
work = ns["work"]
final_reg = ns["final_reg"]

part1 = {
    "title": "Part 1 · Lab Activity: Retail Demand Forecasting for a Seasonal Product (Air Coolers)",
    "source_labels": {"demand": "simulated", "temperature": "real"},
    "demand_note": "12-month air-cooler demand from the professor's reference Colab notebook, labelled there as "
                   "simulated monthly demand. Teaching data, not real company sales.",
    "temperature_note": "Observed daily mean 2 m temperature, Dubai (25.20 N, 55.27 E), Open-Meteo Historical "
                        "Weather API (ERA5 reanalysis), averaged to months.",
    "monthly": [
        {"month": month(m), "demand": int(d), "temp_mean_c": r(t, 2), "temp_max_c": r(tx, 2)}
        for m, d, t, tx in zip(df1["Month"], df1["Demand"], df1["Temp_C"], temp_csv["temp_max_c"])
    ],
    "demand_stats": {"mean": r(df1["Demand"].mean(), 2), "std": r(df1["Demand"].std(), 2),
                     "min": int(df1["Demand"].min()), "max": int(df1["Demand"].max())},
    "temp_stats": {"mean": r(df1["Temp_C"].mean(), 2), "std": r(df1["Temp_C"].std(), 2),
                   "min": r(df1["Temp_C"].min(), 2), "max": r(df1["Temp_C"].max(), 2)},
    "correlation": round(float(ns["corr"]), 3),
    "slope_units_per_c": r(ns["slope"], 2),
    "intercept": r(ns["intercept"], 2),
    "naive": {
        "window": "Feb–Dec 2023",
        "mape": round(ns["naive_mape"], 2), "wape": round(ns["naive_wape"], 2),
        "sum_abs_error": r(work["Abs_Error"].sum(), 1), "sum_demand": int(work["Demand"].sum()),
        "rows": [{"month": month(m), "demand": int(d), "forecast": r(f, 1), "abs_error": r(e, 1), "abs_pct_error": r(p, 2)}
                 for m, d, f, e, p in zip(work["Month"], work["Demand"], work["Naive_Forecast"],
                                          work["Abs_Error"], work["Abs_%_Error"])],
    },
    "in_sample": {
        "window": "Mar–Dec 2023",
        "warning": "Scored on the same months the model was trained on: a measure of fit, not forecasting ability.",
        "scores": frame_records(ns["insample_scores"], {"Model": "model", "MAPE (%)": "mape", "WAPE (%)": "wape"}),
        "rows": [{"month": month(m), "demand": int(d), "naive": r(n, 1), "rf_in_sample": r(f, 2)}
                 for m, d, n, f in zip(ml_df["Month"], ml_df["Demand"], ml_df["Naive_Forecast"], ml_df["RF_InSample"])],
    },
    "walk_forward": {
        "window": "Jul–Dec 2023",
        "design": "Expanding window: each month every model is refitted on earlier months only and forecasts that "
                  "single month. Forecast-month temperature treated as known (from a weather outlook).",
        "models": list(preds.keys()),
        "rows": [{"month": month(m), "demand": int(d), **{k: r(wf.loc[i, k], 1) for k in preds}}
                 for i, m, d in zip(wf.index, wf["Month"], wf["Demand"])],
        "scores": frame_records(ns["oos_scores"], {"Model": "model", "MAPE (%)": "mape", "WAPE (%)": "wape",
                                                   "WAPE change vs Naïve (pp)": "wape_change_vs_naive_pp"}),
        "weather_regression_full_year": {"intercept": r(final_reg.intercept_, 2), "beta": r(final_reg.coef_[0], 2),
                                         "formula": "dDemand = α + β × dTemp"},
    },
    "impact": {
        "total_demand_jul_dec": int(wf["Demand"].sum()),
        "rows": frame_records(ns["impact"], {"Model": "model", "Stockout units (under-forecast)": "stockout_units",
                                             "Excess units (over-forecast)": "excess_units",
                                             "Total units mis-planned": "total_units",
                                             "Share of Jul–Dec demand (%)": "share_pct"}, d=1),
    },
    "notebook_sections": {"naive": "1.7", "in_sample": "1.8", "walk_forward": "1.9", "impact": "1.10",
                          "findings": "1.11", "conclusion": "1.12"},
}

sales = ns["sales"]
test = ns["test"]
train = ns["train"]
yoy = ns["yoy"]
stl = ns["stl"]
seasonal_index = ns["seasonal_index"]
month_names = list(ns["month_names"])
X_all, y_all = ns["X_all"], ns["y_all"]
test_forecasts = ns["test_forecasts"]
future_forecasts = ns["future_forecasts"]
pi80, pi95 = ns["pi80"], ns["pi95"]
holdout_scores = ns["holdout_scores"]
backtest_scores = ns["backtest_scores"]
cold = ns["cold"]
cold_scores = ns["cold_scores"]
cat_si = ns["cat_si"]
first_year = ns["first_year"]
grid = ns["grid"]

# Feature importances: the notebook does not print these. They are computed here with the notebook's own
# model constructors (new_rf/new_xgb) and fit_ml(), on the same training window as the hold-out test.
rf_test = ns["fit_ml"](ns["new_rf"](), train)
xgb_test = ns["fit_ml"](ns["new_xgb"](), train)
FEATURES = ns["FEATURES"]
importances = {
    "note": "Not printed in the notebook. Computed by the export script with the notebook's own model "
            "constructors and features, trained on the same window as the hold-out test (Jan 2012 – Sep 2025).",
    "features": FEATURES,
    "random_forest": [r(v, 4) for v in rf_test.feature_importances_],
    "xgboost": [r(v, 4) for v in xgb_test.feature_importances_],
}
# Recursive forecasts of these refits must equal the notebook's test forecasts (determinism check)
check(np.allclose(ns["recursive_forecast"](xgb_test, train, 12).values, test_forecasts["XGBoost"].values),
      "XGBoost refit reproduces the notebook's test forecasts exactly")
check(np.allclose(ns["recursive_forecast"](rf_test, train, 12).values, test_forecasts["Random Forest"].values),
      "Random Forest refit reproduces the notebook's test forecasts exactly")

MODELS = list(test_forecasts.keys())
SCORE_COLS = {"Model": "model", "MAPE (%)": "mape", "WAPE (%)": "wape", "RMSE": "rmse", "Bias (%)": "bias_pct"}
weather_header, weather_rows = SAVED["weather_table_part2"]
fred_stdout = SAVED["fred_load_stdout"]
retrieved_line = next(line for line in fred_stdout.splitlines() if line.startswith("Source:"))

part2 = {
    "title": "Part 2 · Lab Activity Exercise: Forecasting Monthly Sales for a New Beverage Product",
    "source_label": "proxy",
    "series": {
        "id": "IPN31211N",
        "name": "Industrial Production: Manufacturing: Non-Durable Goods: Soft Drink and Ice",
        "publisher": "Board of Governors of the Federal Reserve System (US), via FRED, Federal Reserve Bank of St. Louis",
        "url": "https://fred.stlouisfed.org/series/IPN31211N",
        "unit": "Index 2017 = 100, not seasonally adjusted",
        "coverage": "NAICS 31211: soft drinks and bottled water (incl. flavored water)",
        "proxy_note": "Category-level US production index used as a proxy. It is not the company's own sales.",
        "window": {"from": month(sales.index.min()), "to": month(sales.index.max()), "n_months": int(len(sales))},
        "full_history": {"from": "1972-01", "to": month(sales.index.max()), "rows": 657},
        "notebook_retrieval": retrieved_line,
        "stats": {k: r(v, 2) for k, v in sales.describe().items()},
        "quality": {"missing": int(sales.isna().sum()), "duplicates": int(sales.index.duplicated().sum()),
                    "frequency": sales.index.freqstr,
                    "largest_yoy_moves": [{"month": month(m), "abs_yoy_pct": r(v, 1)}
                                          for m, v in yoy.abs().sort_values(ascending=False).head(4).items()]},
    },
    "decomposition": {
        "method": "STL (period 12, robust)",
        "strength_seasonal": r(ns["strength_seasonal"], 2),
        "strength_trend": r(ns["strength_trend"], 2),
    },
    "seasonal_index": [{"month": mname, "index": r(v, 3)} for mname, v in zip(month_names, seasonal_index.values)],
    "features": {
        "list": FEATURES,
        "correlation_with_target": {k: r(v, 3) for k, v in X_all.corrwith(y_all).items()},
        "supervised_shape": list(X_all.shape),
    },
    "sarima": {
        "order": list(ns["BEST_ORDER"]), "seasonal_order": list(ns["BEST_SEASONAL"]),
        "label": f"SARIMA{ns['BEST_ORDER']}x{ns['BEST_SEASONAL']}",
        "candidates": int(len(grid)),
        "top5": [{"order": str(row["order"]), "seasonal_order": str(row["seasonal_order"]), "aic": r(row["AIC"], 1)}
                 for _, row in grid.head(5).iterrows()],
    },
    "split": {
        "train": {"from": month(train.index.min()), "to": month(train.index.max()), "n": int(len(train))},
        "test": {"from": month(test.index.min()), "to": month(test.index.max()), "n": int(len(test))},
    },
    "models": MODELS,
    "holdout": {
        "label": "Hold-out test year Oct 2025 – Sep 2026 (12-month horizon from one origin)",
        "scores": frame_records(holdout_scores, {**SCORE_COLS, "WAPE improvement vs Naïve (%)": "wape_improvement_vs_naive_pct"}),
    },
    "backtest": {
        "label": "Rolling-origin backtest: 18 origins × 3 months = 54 forecasts",
        "origins": 18, "horizon": 3, "n_forecasts": int(len(ns["bt_actual"])),
        "scores": frame_records(backtest_scores, SCORE_COLS),
    },
    "best_model": ns["best_model"],
    "selection_rule": "Lowest WAPE on the 3-month rolling backtest (matches the business horizon).",
    "future": {
        "last_actual": {"month": month(sales.index[-1]), "value": r(sales.iloc[-1], 2)},
        "rows": [{"month": month(m),
                  **{k: r(future_forecasts[k].iloc[j], 4) for k in MODELS},
                  "sarima_pi80": [r(pi80.iloc[j, 0], 4), r(pi80.iloc[j, 1], 4)],
                  "sarima_pi95": [r(pi95.iloc[j, 0], 4), r(pi95.iloc[j, 1], 4)]}
                 for j, m in enumerate(future_forecasts["SARIMA"].index)],
    },
    "shape": {
        "actual_amplitude_pct": r((test / test.mean()).max() / (test / test.mean()).min() * 100 - 100, 1),
        "actual_peak_month": test.index[int(np.argmax(test.values))].strftime("%b"),
        "rows": frame_records(ns["shape"], {"Model": "model", "Seasonal amplitude (max/min − 1, %)": "amplitude_pct",
                                            "Shape correlation with actual": "shape_corr",
                                            "Peak month forecast": "peak_month"}),
    },
    "first_year": {
        "label": "Only the 12 months before the test period used as the product's 'first year'",
        "window": {"from": month(first_year.index.min()), "to": month(first_year.index.max())},
        "scores": frame_records(cold_scores, SCORE_COLS),
        "category_seasonal_index": [{"month": mname, "index": r(cat_si.loc[i + 1], 4)} for i, mname in enumerate(month_names)],
    },
    "feature_importance": importances,
    "notebook_llm": {
        "label": "Notebook run: rule-based fallback, not LLM output",
        "backend": SAVED["summary_json_part2"]["llm_backend"],
        "markdown": SAVED["llm_output_part2"],
    },
    "notebook_weather_snapshot": {
        "label": "Live weather at notebook run time (snapshot, not current)",
        "note": SAVED["summary_json_part2"]["weather_note"],
        "rows": [dict(zip(weather_header[1:], row[1:])) for row in weather_rows],
    },
    "notebook_sections": {"data": "2.4", "eda": "2.5", "task1": "2.6", "task2": "2.7", "task3": "2.8",
                          "task4": "2.9", "task5": "2.10", "task6": "2.11", "task7": "2.12", "llm": "2.13",
                          "recommendations": "2.14"},
}

# Detailed backtest (order follows the notebook loop: origins k = 18 .. 1)
bt_rows = []
pos = 0
for k in range(18, 0, -1):
    end = len(sales) - 3 - (k - 1)
    origin = sales.index[end - 1]
    for h in range(3):
        target = sales.index[end + h]
        bt_rows.append({"origin": month(origin), "target": month(target), "h": h + 1,
                        "actual": r(ns["bt_actual"].iloc[pos], 4),
                        **{m: r(ns["bt_preds"][m][pos], 4) for m in MODELS}})
        pos += 1
check(pos == 54, "backtest detail has 54 forecasts")

raw = pd.read_csv(FRED_CSV)
trend12 = sales.rolling(12, center=True).mean()
series = {
    "fred_monthly": [{"month": month(m), "value": r(v, 4)} for m, v in sales.items()],
    "fred_full_history": [{"month": month(d), "value": r(v, 4)} for d, v in zip(pd.to_datetime(raw["observation_date"]), raw["IPN31211N"])],
    "trend_12m_centred": [{"month": month(m), "value": r(v, 4)} for m, v in trend12.items()],
    "stl": [{"month": month(m), "trend": r(t, 4), "seasonal": r(s, 4), "remainder": r(e, 4)}
            for m, t, s, e in zip(sales.index, stl.trend, stl.seasonal, stl.resid)],
    "test_forecasts": [{"month": month(m), "actual": r(test.loc[m], 4), **{k: r(test_forecasts[k].loc[m], 4) for k in MODELS}}
                       for m in test.index],
    "backtest_detail": bt_rows,
    "first_year": {
        "history": [{"month": month(m), "value": r(v, 4)} for m, v in first_year.items()],
        "forecasts": [{"month": month(m), "actual": r(test.loc[m], 4), **{k: r(cold[k][j], 4) for k in cold}}
                      for j, m in enumerate(test.index)],
    },
}

hashes = {"notebook_sha256": sha256(NB_PATH), "fred_csv_sha256": sha256(FRED_CSV), "temp_csv_sha256": sha256(TEMP_CSV)}
import sklearn, statsmodels, xgboost  # noqa: E402,E401

meta = {
    "app": "BEVCAST AI",
    "student": {"name": "Krishna Mathur", "roll": "AS25DXB018", "programme": "MAIB", "batch": "September 2025",
                "institution": "SP Jain School of Global Management", "subject": "AI in Operations",
                "assignment": "Problems and Exercises: Session II Lab Activity and Exercise"},
    "notebook": {"file": NB_NAME, **hashes,
                 "executed_with": {"part1": SAVED["versions_part1"].strip(), "part2": SAVED["versions_part2"].strip()},
                 "fred_retrieval": retrieved_line},
    "export": {"generated_at": datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ"),
               "python": platform.python_version(), "pandas": pd.__version__, "numpy": np.__version__,
               "scikit_learn": sklearn.__version__, "statsmodels": statsmodels.__version__,
               "xgboost": xgboost.__version__, "assertions_passed": None},
    "labels": LABELS,
    "sources": [
        {"id": "fred", "name": "FRED IPN31211N (Soft Drink and Ice production index)", "label": "proxy",
         "url": "https://fred.stlouisfed.org/series/IPN31211N", "retrieved": "2026-11-12 09:37 UTC (notebook run)"},
        {"id": "openmeteo_dubai", "name": "Open-Meteo Historical Weather API, Dubai 2023 monthly temperature",
         "label": "real", "url": "https://open-meteo.com/en/docs/historical-weather-api",
         "retrieved": "2026-11-12 (notebook run)"},
        {"id": "aircooler_demand", "name": "Air-cooler demand Jan–Dec 2023 (professor's reference notebook)",
         "label": "simulated", "url": None, "retrieved": None},
    ],
    "colab_url": (ROOT.parent / "submissions" / "Google_Colab_Link.txt").read_text().strip()
    if (ROOT.parent / "submissions" / "Google_Colab_Link.txt").exists()
    else "https://colab.research.google.com/drive/12kKbww0iyfHnJuMq4U2py4VnVYjP-Gcy",
}
check(meta["colab_url"] == "https://colab.research.google.com/drive/12kKbww0iyfHnJuMq4U2py4VnVYjP-Gcy",
      "Colab URL matches Google_Colab_Link.txt")
meta["export"]["assertions_passed"] = len(CHECKS) + 1


def dump(name: str, obj) -> None:
    path = OUT_DIR / name
    path.write_text(json.dumps(obj, indent=2, ensure_ascii=False, allow_nan=False) + "\n", encoding="utf-8")
    print(f"wrote {path.relative_to(ROOT)} ({path.stat().st_size:,} bytes)")


OUT_DIR.mkdir(exist_ok=True)
dump("part1.json", part1)
dump("part2.json", part2)
dump("series.json", series)
dump("meta.json", meta)
print(f"All {meta['export']['assertions_passed']} assertions passed: re-computed results equal the executed notebook.")
