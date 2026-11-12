/**
 * Forecast accuracy metrics. Lower is better for all of them.
 *
 * MAPE  = mean(|A - F| / |A|) x 100, over months with a non-zero actual. Zero actuals are excluded
 *         (the ratio is undefined) and the number excluded is reported.
 * WAPE  = sum|A - F| / sum|A| x 100. Undefined (null) when sum|A| = 0. WAPE is NOT the average of the
 *         monthly percentage errors: it weights each month by its volume.
 * RMSE  = sqrt(mean((A - F)^2)), in the series' own units.
 * Bias% = sum(F - A) / sum(A) x 100. Positive = over-forecasting (excess stock), negative = stockouts.
 */

export interface MapeResult {
  value: number | null;
  /** Months left out because the actual was zero. */
  excluded: number;
  /** Months that entered the average. */
  used: number;
}

function assertComparable(actual: readonly number[], forecast: readonly number[]): void {
  if (actual.length !== forecast.length) {
    throw new Error(`Length mismatch: ${actual.length} actuals vs ${forecast.length} forecasts`);
  }
  if (actual.length === 0) throw new Error("No values to score");
  for (let i = 0; i < actual.length; i++) {
    if (!Number.isFinite(actual[i]) || !Number.isFinite(forecast[i])) {
      throw new Error(`Non-finite value at position ${i}`);
    }
  }
}

export function mape(actual: readonly number[], forecast: readonly number[]): MapeResult {
  assertComparable(actual, forecast);
  let sum = 0;
  let used = 0;
  for (let i = 0; i < actual.length; i++) {
    if (actual[i] === 0) continue;
    sum += Math.abs((actual[i] - forecast[i]) / actual[i]);
    used++;
  }
  return { value: used === 0 ? null : (sum / used) * 100, excluded: actual.length - used, used };
}

export function wape(actual: readonly number[], forecast: readonly number[]): number | null {
  assertComparable(actual, forecast);
  let num = 0;
  let den = 0;
  for (let i = 0; i < actual.length; i++) {
    num += Math.abs(actual[i] - forecast[i]);
    den += Math.abs(actual[i]);
  }
  return den === 0 ? null : (num / den) * 100;
}

export function rmse(actual: readonly number[], forecast: readonly number[]): number {
  assertComparable(actual, forecast);
  let s = 0;
  for (let i = 0; i < actual.length; i++) s += (actual[i] - forecast[i]) ** 2;
  return Math.sqrt(s / actual.length);
}

export function biasPct(actual: readonly number[], forecast: readonly number[]): number | null {
  assertComparable(actual, forecast);
  let num = 0;
  let den = 0;
  for (let i = 0; i < actual.length; i++) {
    num += forecast[i] - actual[i];
    den += actual[i];
  }
  return den === 0 ? null : (num / den) * 100;
}

export interface MetricSet {
  mape: number | null;
  mapeExcluded: number;
  wape: number | null;
  rmse: number;
  biasPct: number | null;
  n: number;
}

export function scoreAll(actual: readonly number[], forecast: readonly number[]): MetricSet {
  const m = mape(actual, forecast);
  return {
    mape: m.value,
    mapeExcluded: m.excluded,
    wape: wape(actual, forecast),
    rmse: rmse(actual, forecast),
    biasPct: biasPct(actual, forecast),
    n: actual.length,
  };
}
