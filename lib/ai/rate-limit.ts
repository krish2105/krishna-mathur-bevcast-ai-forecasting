/**
 * In-memory sliding-window rate limiter (per server instance). Good enough for a demo on Fluid compute;
 * a shared store (e.g. Upstash) would be needed for strict global limits.
 */
const buckets = new Map<string, number[]>();

export function rateLimit(key: string, limit: number, windowMs = 60_000): { ok: boolean; retryAfter: number; remaining: number } {
  const now = Date.now();
  const hits = (buckets.get(key) ?? []).filter((t) => now - t < windowMs);
  if (hits.length >= limit) {
    buckets.set(key, hits);
    return { ok: false, retryAfter: Math.ceil((windowMs - (now - hits[0])) / 1000), remaining: 0 };
  }
  hits.push(now);
  buckets.set(key, hits);
  if (buckets.size > 5000) {
    for (const [k, v] of buckets) if (v.every((t) => now - t >= windowMs)) buckets.delete(k);
  }
  return { ok: true, retryAfter: 0, remaining: limit - hits.length };
}

export function clientIp(req: Request): string {
  const fwd = req.headers.get("x-forwarded-for");
  return (fwd?.split(",")[0] ?? req.headers.get("x-real-ip") ?? "local").trim();
}
