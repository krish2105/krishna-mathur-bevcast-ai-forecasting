export const GLOSSARY = {
  mape: {
    term: "MAPE",
    definition:
      "Mean Absolute Percentage Error: the average of each month's |actual − forecast| / actual, in %. Every month counts equally, so a miss in a small month weighs as much as in a big month. Months with zero actual are excluded.",
  },
  wape: {
    term: "WAPE",
    definition:
      "Weighted Absolute Percentage Error: total |actual − forecast| divided by total actual, in %. Big months count more, so it tracks the real cost of mis-planned volume. It is not the average of monthly percentages.",
  },
  rmse: {
    term: "RMSE",
    definition: "Root Mean Squared Error, in the series' own units. Penalises large misses more than small ones.",
  },
  bias: {
    term: "Bias %",
    definition: "Sum of (forecast − actual) / sum of actual. Positive = over-forecasting (excess stock); negative = under-forecasting (stockouts).",
  },
  backtest: {
    term: "Rolling-origin backtest",
    definition:
      "The model is refitted at many past months (origins) and forecasts the next few months each time. Errors are pooled, so the score does not depend on one lucky test window.",
  },
  holdout: {
    term: "Hold-out test",
    definition: "The most recent months are hidden while the model is fitted, then forecast from one origin and scored.",
  },
  interval: {
    term: "Prediction interval",
    definition:
      "A range that should contain the actual value with a stated probability (80% or 95%). Wider bands mean more uncertainty; they widen with the horizon.",
  },
  seasonalIndex: {
    term: "Seasonal index",
    definition: "How much a calendar month is above or below an average month. 1.03 means 3% above average.",
  },
  naive: {
    term: "Naïve forecast",
    definition: "Next month equals this month. Free to build, so any model must beat it to be worth using.",
  },
  walkForward: {
    term: "Walk-forward validation",
    definition: "Each month the model is refitted on earlier months only and forecasts that single month, as it would be used in practice.",
  },
  inSample: {
    term: "In-sample score",
    definition: "Error measured on the same months the model was trained on. It measures fit, not forecasting ability, and can be misleading.",
  },
  proxy: {
    term: "Category proxy",
    definition: "Real industry data (FRED IPN31211N) used in place of the company's own sales, which are not public.",
  },
  wapeImprovement: {
    term: "Improvement vs Naïve",
    definition: "Relative WAPE reduction compared with the Naïve benchmark: (1 − model WAPE / Naïve WAPE) × 100.",
  },
} as const;

export type GlossaryTerm = keyof typeof GLOSSARY;
