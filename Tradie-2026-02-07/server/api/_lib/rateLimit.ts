/**
 * Best-effort per-instance rate limit. Vercel may run several instances, so this
 * is a brake on runaway loops, not a security boundary — the voice allowance in
 * RevenueCat is what actually caps free use.
 */
const hits = new Map<string, number[]>();

export function isRateLimited(key: string, windowMs: number, max: number): boolean {
  const now = Date.now();
  const recent = (hits.get(key) ?? []).filter((t) => now - t < windowMs);
  recent.push(now);
  hits.set(key, recent);
  return recent.length > max;
}
