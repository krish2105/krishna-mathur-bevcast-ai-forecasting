/**
 * In-app forecasting engine (TypeScript). Runs in the browser and on Vercel without Python.
 * These results are labelled "In-app engine results" and are never mixed with the notebook's
 * reference results (SARIMA, Random Forest, XGBoost), which are precomputed in Python.
 *
 * Every model is a pure function: (history, months of history, horizon) -> point forecasts.
 * A model only ever sees the history it is given, so callers control leakage by slicing.
 */
import { monthOfYear, nextMonths } from "./dates";
import { nelderMead } from "./optimize";

export type ModelId =
  | "naive"
  | "seasonal-naive"
  | "moving-average"
  | "holt-winters-add"
  | "holt-winters-mul"
  | "ridge-lags"
  | "si-transfer";

export interface ModelContext {
  /** Calendar months of `history`, "YYYY-MM", consecutive. */
  months: readonly string[];
  /** Category seasonal index Jan..Dec (1.00 = average month), needed by "si-transfer". */
  categoryIndex?: readonly number[];
}

export interface ModelSpec {
  id: ModelId;
  name: string;
  short: string;
  family: "Benchmark" | "Exponential smoothing" | "Regression" | "New-product";
  description: string;
  /** Minimum history length the model needs to fit. */
  minHistory: (ctx: { n: number }) => number;
  /** Needs two or more full seasonal cycles. */
  seasonal2Cycles: boolean;
  forecast: (history: readonly number[], h: number, ctx: ModelContext) => number[];
}

const PERIOD = 12;

// ---------------------------------------------------------------- benchmarks
export function naive(history: readonly number[], h: number): number[] {
  if (history.length < 1) throw new Error("Naïve needs at least 1 observation");
  return Array.from({ length: h }, () => history[history.length - 1]);
}

/** Same month last year; for h > 12 the last 12 months repeat (as in the notebook). */
export function seasonalNaive(history: readonly number[], h: number, m = PERIOD): number[] {
  if (history.length < m) throw new Error(`Seasonal Naïve needs at least ${m} observations`);
  const n = history.length;
  return Array.from({ length: h }, (_, j) => history[n - m + (j % m)]);
}

export function movingAverage(history: readonly number[], h: number, window = 3): number[] {
  if (history.length < window) throw new Error(`Moving average needs at least ${window} observations`);
  const tail = history.slice(-window);
  const mean = tail.reduce((a, b) => a + b, 0) / window;
  return Array.from({ length: h }, () => mean);
}

// ---------------------------------------------------------------- Holt-Winters
export interface HoltWintersParams {
  alpha: number;
  beta: number;
  gamma: number;
  phi: number;
}

interface HwState {
  level: number;
  trend: number;
  season: number[];
  sse: number;
}

function hwRun(y: readonly number[], p: HoltWintersParams, multiplicative: boolean, m = PERIOD): HwState {
  const first = y.slice(0, m);
  const second = y.slice(m, 2 * m);
  const mean1 = first.reduce((a, b) => a + b, 0) / m;
  const mean2 = second.reduce((a, b) => a + b, 0) / m;
  let level = mean1;
  let trend = (mean2 - mean1) / m;
  const season = first.map((v) => (multiplicative ? v / mean1 : v - mean1));
  let sse = 0;
  for (let t = 0; t < y.length; t++) {
    const s = season[t % m];
    const base = level + p.phi * trend;
    const fitted = multiplicative ? base * s : base + s;
    sse += (y[t] - fitted) ** 2;
    const newLevel = multiplicative
      ? p.alpha * (y[t] / s) + (1 - p.alpha) * base
      : p.alpha * (y[t] - s) + (1 - p.alpha) * base;
    trend = p.beta * (newLevel - level) + (1 - p.beta) * p.phi * trend;
    season[t % m] = multiplicative
      ? p.gamma * (y[t] / newLevel) + (1 - p.gamma) * s
      : p.gamma * (y[t] - newLevel) + (1 - p.gamma) * s;
    level = newLevel;
  }
  return { level, trend, season, sse };
}

const logistic = (x: number) => 1 / (1 + Math.exp(-x));

/** Parameters chosen by minimising one-step-ahead squared error (Nelder-Mead, deterministic starts). */
export function fitHoltWinters(y: readonly number[], multiplicative: boolean, damped = true): HoltWintersParams {
  if (y.length < 2 * PERIOD) throw new Error("Holt-Winters needs at least two full seasonal cycles (24 months)");
  if (multiplicative && y.some((v) => v <= 0)) throw new Error("Multiplicative Holt-Winters needs positive values");
  const decode = (x: number[]): HoltWintersParams => ({
    alpha: 0.001 + 0.998 * logistic(x[0]),
    beta: 0.001 + 0.998 * logistic(x[1]) * 0.5, // trend smoothing kept modest for stability
    gamma: 0.001 + 0.998 * logistic(x[2]),
    phi: damped ? 0.8 + 0.18 * logistic(x[3]) : 1,
  });
  const objective = (x: number[]) => {
    const s = hwRun(y, decode(x), multiplicative);
    return Number.isFinite(s.sse) ? s.sse : 1e300;
  };
  let best = { x: [0, -2, -1, 1], f: Infinity };
  for (const start of [[0, -2, -1, 1], [1.5, -3, -2, 2], [-1, -1, 0, 0]]) {
    const r = nelderMead(objective, start, { maxIter: 600, tol: 1e-10 });
    if (r.f < best.f) best = r;
  }
  return decode(best.x);
}

export function holtWinters(
  history: readonly number[],
  h: number,
  multiplicative: boolean,
  damped = true,
  params?: HoltWintersParams,
): number[] {
  const p = params ?? fitHoltWinters(history, multiplicative, damped);
  const s = hwRun(history, p, multiplicative);
  const n = history.length;
  const out: number[] = [];
  let phiSum = 0;
  for (let k = 1; k <= h; k++) {
    phiSum += p.phi ** k;
    const base = s.level + phiSum * s.trend;
    const seas = s.season[(n + k - 1) % PERIOD];
    out.push(multiplicative ? base * seas : base + seas);
  }
  return out;
}

// ---------------------------------------------------------------- ridge regression on lags + month
/** Builds the feature row for forecasting the month `targetMonth` from `hist` (strictly earlier values). */
export function lagFeatures(hist: readonly number[], targetMonth: string, useLag12: boolean): number[] {
  const n = hist.length;
  const m = monthOfYear(targetMonth);
  const f = [hist[n - 1], hist[n - 2], hist[n - 3]];
  if (useLag12) f.push(hist[n - 12]);
  f.push(Math.sin((2 * Math.PI * m) / 12), Math.cos((2 * Math.PI * m) / 12));
  return f;
}

function solveSymmetric(A: number[][], b: number[]): number[] {
  // Gaussian elimination with partial pivoting (A is small: <= 7 x 7)
  const n = b.length;
  const M = A.map((row, i) => [...row, b[i]]);
  for (let c = 0; c < n; c++) {
    let piv = c;
    for (let r = c + 1; r < n; r++) if (Math.abs(M[r][c]) > Math.abs(M[piv][c])) piv = r;
    [M[c], M[piv]] = [M[piv], M[c]];
    if (Math.abs(M[c][c]) < 1e-12) throw new Error("Singular system in ridge regression");
    for (let r = c + 1; r < n; r++) {
      const k = M[r][c] / M[c][c];
      for (let j = c; j <= n; j++) M[r][j] -= k * M[c][j];
    }
  }
  const x = new Array<number>(n).fill(0);
  for (let r = n - 1; r >= 0; r--) {
    let s = M[r][n];
    for (let j = r + 1; j < n; j++) s -= M[r][j] * x[j];
    x[r] = s / M[r][r];
  }
  return x;
}

export interface RidgeModel {
  useLag12: boolean;
  mean: number[];
  scale: number[];
  coef: number[];
  intercept: number;
}

/** Closed-form ridge on standardised features; the intercept is not penalised. */
export function fitRidge(history: readonly number[], months: readonly string[], lambda = 1): RidgeModel {
  const useLag12 = history.length >= 36;
  const start = useLag12 ? 12 : 3;
  if (history.length - start < 8) throw new Error("Ridge regression needs at least 11 observations");
  const X: number[][] = [];
  const y: number[] = [];
  for (let t = start; t < history.length; t++) {
    X.push(lagFeatures(history.slice(0, t), months[t], useLag12));
    y.push(history[t]);
  }
  const p = X[0].length;
  const mean = Array.from({ length: p }, (_, j) => X.reduce((a, r) => a + r[j], 0) / X.length);
  const scale = Array.from({ length: p }, (_, j) => {
    const v = X.reduce((a, r) => a + (r[j] - mean[j]) ** 2, 0) / X.length;
    return Math.sqrt(v) || 1;
  });
  const Z = X.map((r) => r.map((v, j) => (v - mean[j]) / scale[j]));
  const yMean = y.reduce((a, b) => a + b, 0) / y.length;
  const A = Array.from({ length: p }, (_, i) =>
    Array.from({ length: p }, (_, j) => Z.reduce((a, r) => a + r[i] * r[j], 0) + (i === j ? lambda : 0)),
  );
  const b = Array.from({ length: p }, (_, i) => Z.reduce((a, r, k) => a + r[i] * (y[k] - yMean), 0));
  return { useLag12, mean, scale, coef: solveSymmetric(A, b), intercept: yMean };
}

/** Recursive multi-step forecast: each prediction becomes history for the next step. */
export function ridgeForecast(history: readonly number[], months: readonly string[], h: number): number[] {
  const model = fitRidge(history, months);
  const hist = [...history];
  const future = nextMonths(months[months.length - 1], h);
  return future.map((month) => {
    const f = lagFeatures(hist, month, model.useLag12);
    const yhat = model.intercept + f.reduce((a, v, j) => a + ((v - model.mean[j]) / model.scale[j]) * model.coef[j], 0);
    hist.push(yhat);
    return yhat;
  });
}

// ---------------------------------------------------------------- category seasonal-index transfer
/**
 * New-product method from the notebook (Section 2.12.3): level from the product's own recent sales after
 * removing seasonality, multiplied by the category's seasonal pattern.
 */
export function seasonalIndexTransfer(
  history: readonly number[],
  months: readonly string[],
  h: number,
  categoryIndex: readonly number[],
  levelWindow = 6,
): number[] {
  if (categoryIndex.length !== 12) throw new Error("Category seasonal index must have 12 values");
  if (history.length < levelWindow) throw new Error(`Seasonal-index transfer needs at least ${levelWindow} observations`);
  const n = history.length;
  let sum = 0;
  for (let t = n - levelWindow; t < n; t++) sum += history[t] / categoryIndex[monthOfYear(months[t]) - 1];
  const level = sum / levelWindow;
  return nextMonths(months[n - 1], h).map((m) => level * categoryIndex[monthOfYear(m) - 1]);
}

// ---------------------------------------------------------------- registry
export const MODELS: Record<ModelId, ModelSpec> = {
  naive: {
    id: "naive",
    name: "Naïve",
    short: "Naïve",
    family: "Benchmark",
    description: "Next month equals the last observed month. The benchmark every model must beat.",
    minHistory: () => 1,
    seasonal2Cycles: false,
    forecast: (y, h) => naive(y, h),
  },
  "seasonal-naive": {
    id: "seasonal-naive",
    name: "Seasonal Naïve",
    short: "S-Naïve",
    family: "Benchmark",
    description: "Each month equals the same month last year.",
    minHistory: () => 12,
    seasonal2Cycles: false,
    forecast: (y, h) => seasonalNaive(y, h),
  },
  "moving-average": {
    id: "moving-average",
    name: "Moving average (3 months)",
    short: "MA(3)",
    family: "Benchmark",
    description: "Average of the last three months, held flat.",
    minHistory: () => 3,
    seasonal2Cycles: false,
    forecast: (y, h) => movingAverage(y, h, 3),
  },
  "holt-winters-add": {
    id: "holt-winters-add",
    name: "Holt-Winters (additive, damped)",
    short: "HW add.",
    family: "Exponential smoothing",
    description: "Smoothed level, damped trend and additive monthly seasonal effects.",
    minHistory: () => 24,
    seasonal2Cycles: true,
    forecast: (y, h) => holtWinters(y, h, false, true),
  },
  "holt-winters-mul": {
    id: "holt-winters-mul",
    name: "Holt-Winters (multiplicative, damped)",
    short: "HW mult.",
    family: "Exponential smoothing",
    description: "Smoothed level, damped trend and multiplicative monthly seasonal factors.",
    minHistory: () => 24,
    seasonal2Cycles: true,
    forecast: (y, h) => holtWinters(y, h, true, true),
  },
  "ridge-lags": {
    id: "ridge-lags",
    name: "Ridge regression (lags + month)",
    short: "Ridge",
    family: "Regression",
    description: "Linear model on lags 1–3 (and lag 12 with 3+ years of data) plus month sin/cos, ridge-penalised.",
    minHistory: () => 11,
    seasonal2Cycles: false,
    forecast: (y, h, ctx) => ridgeForecast(y, ctx.months, h),
  },
  "si-transfer": {
    id: "si-transfer",
    name: "Category seasonal-index transfer",
    short: "SI transfer",
    family: "New-product",
    description: "Own recent level × the beverage category's seasonal pattern (FRED IPN31211N seasonal index).",
    minHistory: () => 6,
    seasonal2Cycles: false,
    forecast: (y, h, ctx) => {
      if (!ctx.categoryIndex) throw new Error("Category seasonal index not provided");
      return seasonalIndexTransfer(y, ctx.months, h, ctx.categoryIndex);
    },
  },
};

export const MODEL_IDS = Object.keys(MODELS) as ModelId[];
