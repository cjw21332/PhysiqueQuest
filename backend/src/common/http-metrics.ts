const routes = new Map<string, { requests: number; errors: number; totalMs: number; maxMs: number }>();
export function recordHttpRequest(route: string, status: number, ms: number) {
  const key = routes.has(route) || routes.size < 200 ? route : 'other';
  const value = routes.get(key) ?? { requests: 0, errors: 0, totalMs: 0, maxMs: 0 };
  value.requests++; value.errors += Number(status >= 500); value.totalMs += ms; value.maxMs = Math.max(value.maxMs, ms);
  routes.set(key, value);
}
export function httpMetrics() {
  return { uptimeSeconds: Math.floor(process.uptime()), routes: [...routes].map(([route, value]) => ({ route, requests: value.requests, errors: value.errors, meanMs: Number((value.totalMs / value.requests).toFixed(2)), maxMs: Number(value.maxMs.toFixed(2)) })) };
}
