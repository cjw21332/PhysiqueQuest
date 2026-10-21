export function securityHeaders(development, env = process.env) {
  const origins = [];
  for (const name of ['NEXT_PUBLIC_API_URL', 'NEXT_PUBLIC_COACH_API_URL', 'NEXT_PUBLIC_SENTRY_DSN']) {
    if (!env[name]) continue;
    const url = new URL(env[name]);
    if (!['http:', 'https:'].includes(url.protocol)) throw Error(`Invalid ${name}`);
    origins.push(url.origin);
  }
  // shortcut: static Next hydration needs inline scripts; use nonce rendering when the app moves off static pages.
  const policy = [`default-src 'self'`, `base-uri 'self'`, `object-src 'none'`, `frame-ancestors 'none'`, `form-action 'self'`,
    `script-src 'self' 'unsafe-inline' 'wasm-unsafe-eval'${development ? " 'unsafe-eval'" : ''}`,
    `style-src 'self' 'unsafe-inline'`, `img-src 'self' data: blob: https:`, `font-src 'self'`, `worker-src 'self' blob:`,
    `media-src 'self' blob:`, `connect-src 'self' ${development ? 'http: https: ws: wss:' : origins.join(' ')}`].join('; ');
  return [{ key: 'Content-Security-Policy', value: policy }, { key: 'X-Content-Type-Options', value: 'nosniff' },
    { key: 'X-Frame-Options', value: 'DENY' }, { key: 'Referrer-Policy', value: 'no-referrer' },
    { key: 'Permissions-Policy', value: 'camera=(self), microphone=(self), geolocation=(self)' },
    ...(!development ? [{ key: 'Strict-Transport-Security', value: 'max-age=31536000; includeSubDomains' }] : [])];
}
