/** Transcription of the class slides (no photos) and the requirement-by-requirement compliance matrix. */

export const PART1_SLIDE = {
  heading: "Session II : Lab Activity (slide 57)",
  useCase: "Retail Demand Forecasting for a Seasonal Product",
  scenario:
    "A retail company sells a seasonal product, air coolers, across 12 months. The demand fluctuates based on temperature, promotions, and seasonality. The company wants to forecast monthly demand to optimize inventory and reduce stockouts.",
  objective: "Compare baseline Naïve forecast with a Machine Learning model using MAPE and WAPE metrics.",
};

export const PART2_SLIDE = {
  heading: "Session II : Lab Activity – Exercise (two slides)",
  useCase: "Forecasting Monthly Sales for a New Beverage Product",
  scenario:
    "A beverage company has launched a new flavored water product in regional markets. They've collected monthly sales data for the first year and want to forecast demand for the upcoming months to optimize production and distribution. Students are tasked with applying a chosen forecasting model (e.g., Naive, ARIMA, Random Forest, XGBoost) and evaluating its performance using MAPE and WAPE.",
  tasks: [
    "Preprocess the dataset (lag features or seasonal indicators if needed).",
    "Choose a forecasting model (Naïve, ARIMA, or ML-based, e.g. Random Forest).",
    "Train and test the model (appropriate train-test split).",
    "Generate forecasts (predict the next 3 months).",
    "Evaluate performance (MAPE and WAPE).",
    "Visualize results (plot actual vs predicted sales).",
    "Interpret insights: How well did the model capture seasonality or trends? Which model performed best and why? What recommendations would you give the company?",
  ],
  llm: "Must add LLM to create an interpretation based on real-time data. (Refer to Day 10 of RDMU for LLM integration.)",
  outcomes: [
    "Understand model selection and feature engineering",
    "Hands-on forecasting metrics",
    "Interpret and communicate model results using LLM",
    "Appreciate the business impact of accurate forecasting",
  ],
};

export const SUBMISSION_REQUEST =
  "One complete zip containing the notebook, the one-page summary, the data, the GitHub repo link, the Vercel deployed URL and the Google Colab link, plus a separate full Next.js dashboard deployed on Vercel.";

export interface ComplianceRow {
  id: string;
  requirement: string;
  app: { label: string; href: string }[];
  notebook: string;
  evidence: string;
  status: "Met" | "Met (with note)";
}

export const COMPLIANCE: ComplianceRow[] = [
  {
    id: "p1",
    requirement: "Part 1: compare a baseline Naïve forecast with an ML model using MAPE and WAPE",
    app: [{ label: "Part 1 · Air-Cooler Lab", href: "/lab-air-coolers" }],
    notebook: "§1.7–1.10",
    evidence: "Naïve 17.35% / 15.84% (Feb–Dec); Random Forest in-sample vs walk-forward; weather-adjusted best at 12.00% / 11.98%",
    status: "Met",
  },
  {
    id: "t1",
    requirement: "Task 1: preprocess the dataset (lag features / seasonal indicators)",
    app: [
      { label: "Sales Analysis", href: "/analysis#features" },
      { label: "Methodology", href: "/methodology#features" },
    ],
    notebook: "§2.6",
    evidence: "Lags 1, 2, 3, 12; 3- and 12-month rolling means; month sin/cos; leakage-free feature builder",
    status: "Met",
  },
  {
    id: "t2",
    requirement: "Task 2: choose a forecasting model (Naïve, ARIMA, ML)",
    app: [{ label: "Model Comparison", href: "/models" }],
    notebook: "§2.7",
    evidence: "Six models across three families; SARIMA(1,1,2)x(1,1,1,12) chosen by AIC over 36 candidates",
    status: "Met",
  },
  {
    id: "t3",
    requirement: "Task 3: train and test with an appropriate split",
    app: [
      { label: "Forecasting Lab", href: "/forecasting" },
      { label: "Methodology", href: "/methodology#validation" },
    ],
    notebook: "§2.8, §2.10.2",
    evidence: "Chronological split, last 12 months held out; 18-origin rolling 3-month backtest (54 forecasts)",
    status: "Met",
  },
  {
    id: "t4",
    requirement: "Task 4: forecast the next 3 months",
    app: [
      { label: "Overview", href: "/" },
      { label: "Forecasting Lab", href: "/forecasting" },
    ],
    notebook: "§2.9",
    evidence: "Oct–Dec 2026 from every model refitted on all data, with SARIMA 80/95% intervals; in-app engine forecasts exactly 3 months for any upload",
    status: "Met",
  },
  {
    id: "t5",
    requirement: "Task 5: evaluate with MAPE and WAPE",
    app: [
      { label: "Model Comparison", href: "/models" },
      { label: "Methodology", href: "/methodology#metrics" },
    ],
    notebook: "§2.10",
    evidence: "Hold-out and backtest tables with MAPE, WAPE, RMSE, bias; formulas and zero-actual handling",
    status: "Met",
  },
  {
    id: "t6",
    requirement: "Task 6: plot actual vs predicted",
    app: [
      { label: "Model Comparison", href: "/models#actual-vs-predicted" },
      { label: "Overview", href: "/" },
    ],
    notebook: "§2.11",
    evidence: "Test-year overlay with model toggles, residual plot, forward forecast chart; every chart has a data table",
    status: "Met",
  },
  {
    id: "t7",
    requirement: "Task 7: interpret insights (seasonality/trend, best model and why, recommendations)",
    app: [{ label: "Insights & Planning", href: "/insights" }],
    notebook: "§2.12, §2.14",
    evidence: "Evidence-based answers with numbers; first-year-only scenario; production and distribution ranges",
    status: "Met",
  },
  {
    id: "llm",
    requirement: "Must add an LLM to create an interpretation based on real-time data",
    app: [
      { label: "BevCast AI Copilot", href: "/copilot" },
      { label: "Real-Time Signals", href: "/live" },
      { label: "AI executive summary", href: "/#ai-summary" },
    ],
    notebook: "§2.13",
    evidence:
      "Tool-calling Google Gemini copilot grounded on live FRED and Open-Meteo feeds plus the user's uploaded data; notebook uses google.colab.ai with a labelled fallback",
    status: "Met (with note)",
  },
];

export const COMPLIANCE_NOTE =
  "Day 10 of RDMU was not found on this computer, so its contents are not assumed. The notebook follows the professor's reference Colab (google.colab.ai). The web app uses the Google Gemini API through the Vercel AI SDK. In the saved notebook run no LLM was reachable, so its Section 2.13 shows the clearly labelled rule-based fallback; running it in Colab produces the LLM text.";
