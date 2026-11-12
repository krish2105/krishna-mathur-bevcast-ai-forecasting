/**
 * One visual identity per series, used by every chart, legend and table. Colours are CSS variables
 * (globals.css); dash patterns are the secondary encoding required because the fixed palette fails the
 * colour-vision checks for XGBoost/Holt-Winters and Seasonal Naïve/Naïve (see docs/DESIGN.md).
 */
export interface SeriesStyle {
  color: string;
  dash?: string;
  width: number;
}

export const SERIES_STYLE: Record<string, SeriesStyle> = {
  Actual: { color: "var(--m-actual)", width: 2.5 },
  "Naïve": { color: "var(--m-naive)", dash: "1 4", width: 2 },
  "Seasonal Naïve": { color: "var(--m-snaive)", dash: "8 3 2 3", width: 2 },
  SARIMA: { color: "var(--m-sarima)", dash: "6 3", width: 2 },
  "Holt-Winters": { color: "var(--m-hw)", dash: "10 4", width: 2 },
  "Random Forest": { color: "var(--m-rf)", dash: "3 3", width: 2 },
  XGBoost: { color: "var(--m-xgb)", width: 2 },
  // Part 1
  "Weather-adjusted regression": { color: "var(--m-weather)", dash: "6 3", width: 2 },
  "Random Forest (lags)": { color: "var(--m-rf)", dash: "3 3", width: 2 },
  "Random Forest (lags + temp)": { color: "var(--m-xgb)", dash: "10 4", width: 2 },
  "Random Forest (in-sample fit)": { color: "var(--m-rf)", dash: "3 3", width: 2 },
  Temperature: { color: "var(--m-temp)", dash: "6 3", width: 2 },
  // In-app engine
  "Moving average (3 months)": { color: "var(--m-ma)", dash: "2 2", width: 2 },
  "Holt-Winters (additive, damped)": { color: "var(--m-hw)", dash: "10 4", width: 2 },
  "Holt-Winters (multiplicative, damped)": { color: "var(--m-hwmul)", dash: "4 2 1 2", width: 2 },
  "Ridge regression (lags + month)": { color: "var(--m-rf)", dash: "3 3", width: 2 },
  "Category seasonal-index transfer": { color: "var(--m-si)", width: 2 },
  // Context series
  "Training data": { color: "var(--muted-foreground)", width: 1.5 },
  "12-month trend": { color: "var(--m-sarima)", width: 2.5 },
  "XGBoost (test year)": { color: "var(--m-xgb)", dash: "4 3", width: 2 },
  "First year (training)": { color: "var(--muted-foreground)", width: 1.5 },
  "Your data": { color: "var(--m-actual)", width: 2.5 },
  // First-year scenario (notebook names)
  "Naïve (first year only)": { color: "var(--m-naive)", dash: "1 4", width: 2 },
  "Random Forest lags 1–2 (first year only)": { color: "var(--m-rf)", dash: "3 3", width: 2 },
  "Seasonal-index transfer (first year + category pattern)": { color: "var(--m-si)", width: 2 },
};

export function styleFor(name: string): SeriesStyle {
  return SERIES_STYLE[name] ?? { color: "var(--m-ma)", width: 2 };
}

/** Engine model id -> display name used in SERIES_STYLE */
export const ENGINE_STYLE_NAME: Record<string, string> = {
  naive: "Naïve",
  "seasonal-naive": "Seasonal Naïve",
  "moving-average": "Moving average (3 months)",
  "holt-winters-add": "Holt-Winters (additive, damped)",
  "holt-winters-mul": "Holt-Winters (multiplicative, damped)",
  "ridge-lags": "Ridge regression (lags + month)",
  "si-transfer": "Category seasonal-index transfer",
};
