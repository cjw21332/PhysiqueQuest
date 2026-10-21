// Cloudflare Worker: bind private R2 bucket as MEDIA and set CDN_SIGNING_KEY privately.
export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const expires = url.searchParams.get('expires'), signature = url.searchParams.get('signature');
    const match = /^\/media\/([a-f0-9]{64})$/.exec(url.pathname);
    const reject = () => new Response('Not found', { status: 404, headers: { 'Cache-Control': 'no-store' } });
    const origin = request.headers.get('Origin');
    const allowed = (env.CORS_ALLOWED_ORIGINS || '').split(',').map(value => value.trim()).filter(Boolean);
    if (origin && !allowed.includes(origin)) return reject();
    const cors = origin ? { 'Access-Control-Allow-Origin': origin, Vary: 'Origin' } : {};
    const now = Math.floor(Date.now() / 1000);
    if (!['GET', 'OPTIONS'].includes(request.method) || !match || !/^\d{10}$/.test(expires || '') || Number(expires) < now || Number(expires) > now + 60 || !/^[a-f0-9]{64}$/.test(signature || '') || !env.CDN_SIGNING_KEY) return reject();
    try {
      const raw = Uint8Array.from(atob(env.CDN_SIGNING_KEY), character => character.charCodeAt(0));
      if (raw.length !== 32) return reject();
      const key = await crypto.subtle.importKey('raw', raw, { name: 'HMAC', hash: 'SHA-256' }, false, ['verify']);
      const bytes = Uint8Array.from(signature.match(/../g), pair => parseInt(pair, 16));
      if (!await crypto.subtle.verify('HMAC', key, bytes, new TextEncoder().encode(`GET:${url.pathname}:${expires}`))) return reject();
      if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: { ...cors, 'Access-Control-Allow-Methods': 'GET, OPTIONS', 'Access-Control-Allow-Headers': 'Range', 'Cache-Control': 'no-store' } });
      const object = await env.MEDIA.get(`media/${match[1]}`);
      if (!object) return reject();
      return new Response(object.body, { headers: { ...cors, 'Content-Type': object.httpMetadata?.contentType || 'application/octet-stream', 'Content-Disposition': 'attachment', 'X-Content-Type-Options': 'nosniff', 'Content-Security-Policy': "default-src 'none'", 'Cache-Control': `private, max-age=${Math.max(0, Number(expires) - now)}`, 'Referrer-Policy': 'no-referrer' } });
    } catch { return reject(); }
  },
};
