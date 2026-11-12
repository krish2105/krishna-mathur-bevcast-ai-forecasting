/** Deterministic Nelder-Mead minimiser (no randomness, so results are reproducible). */
export function nelderMead(
  f: (x: number[]) => number,
  x0: number[],
  opts: { maxIter?: number; tol?: number; step?: number } = {},
): { x: number[]; f: number } {
  const { maxIter = 500, tol = 1e-9, step = 0.5 } = opts;
  const n = x0.length;
  let simplex = [x0.slice()];
  for (let i = 0; i < n; i++) {
    const v = x0.slice();
    v[i] += step;
    simplex.push(v);
  }
  let values = simplex.map(f);
  for (let iter = 0; iter < maxIter; iter++) {
    const order = values.map((v, i) => [v, i] as const).sort((a, b) => a[0] - b[0]).map(([, i]) => i);
    simplex = order.map((i) => simplex[i]);
    values = order.map((i) => values[i]);
    if (Math.abs(values[n] - values[0]) <= tol * (Math.abs(values[0]) + tol)) break;
    const centroid = Array.from({ length: n }, (_, j) => simplex.slice(0, n).reduce((a, p) => a + p[j], 0) / n);
    const along = (t: number) => centroid.map((c, j) => c + t * (simplex[n][j] - c));
    const xr = along(-1);
    const fr = f(xr);
    if (fr < values[0]) {
      const xe = along(-2);
      const fe = f(xe);
      [simplex[n], values[n]] = fe < fr ? [xe, fe] : [xr, fr];
    } else if (fr < values[n - 1]) {
      [simplex[n], values[n]] = [xr, fr];
    } else {
      const xc = fr < values[n] ? along(-0.5) : along(0.5);
      const fc = f(xc);
      if (fc < Math.min(fr, values[n])) {
        [simplex[n], values[n]] = [xc, fc];
      } else {
        for (let i = 1; i <= n; i++) {
          simplex[i] = simplex[i].map((v, j) => simplex[0][j] + 0.5 * (v - simplex[0][j]));
          values[i] = f(simplex[i]);
        }
      }
    }
  }
  const best = values.indexOf(Math.min(...values));
  return { x: simplex[best], f: values[best] };
}
