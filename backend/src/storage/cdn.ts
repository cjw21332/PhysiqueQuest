import { createHmac } from 'node:crypto';
export function cdnDownloadUrl(key: string, env = process.env, maximumExpiry?: Date) {
  if (!env.CDN_BASE_URL) return undefined;
  const secret = env.CDN_SIGNING_KEY;
  if (!secret || !/^[a-f0-9]{64}$/.test(key)) throw new Error('Private CDN is not configured');
  const url = new URL(`/media/${key}`, env.CDN_BASE_URL);
  const expires = String(Math.floor(Math.min(Date.now() + 60_000, maximumExpiry?.getTime() ?? Infinity) / 1000));
  const signature = createHmac('sha256', Buffer.from(secret, 'base64')).update(`GET:${url.pathname}:${expires}`).digest('hex');
  url.search = new URLSearchParams({ expires, signature }).toString();
  return url.toString();
}
