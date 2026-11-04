import { isIP } from 'node:net';

/** Private transport only: link-local/metadata and public addresses are excluded. */
export function isPrivateChatAddress(value: string): boolean {
  const address = value.replace(/^\[|\]$/g, '').toLowerCase();
  if (address === '::1') return true;
  if (/^::ffff:\d+\.\d+\.\d+\.\d+$/.test(address)) return isPrivateChatAddress(address.slice(7));
  if (isIP(address) === 6) return /^f[cd][0-9a-f]{2}:/.test(address);
  if (isIP(address) !== 4) return false;
  const parts = address.split('.').map(Number);
  return parts[0] === 127 || parts[0] === 10 ||
    (parts[0] === 172 && parts[1] >= 16 && parts[1] <= 31) ||
    (parts[0] === 192 && parts[1] === 168);
}

export const CHAT_CONFIG_KEYS = [
  'NODE_ENV', 'CHAT_OLLAMA_URL', 'CHAT_OLLAMA_MODEL', 'CHAT_OLLAMA_ALLOWED_HOSTS', 'CHAT_TIMEOUT_MS',
  'CHAT_KEEP_ALIVE', 'CHAT_MAX_OUTPUT_TOKENS', 'CHAT_CONTEXT_TOKENS', 'CHAT_MAX_CONCURRENCY',
  'CHAT_MODEL_CHECK_TTL_MS', 'CHAT_WARMUP_ENABLED', 'CHAT_WARMUP_TIMEOUT_MS',
] as const;

export function chatConfig(env: Record<string, unknown>) {
  const read = (name: string) => String(env[name] ?? '').trim();
  const invalid = (name: string): never => { throw new Error('Invalid ' + name); };
  const integer = (name: string, fallback: number, min: number, max: number) => {
    const raw = read(name) || String(fallback);
    if (!/^\d+$/.test(raw) || !Number.isSafeInteger(Number(raw)) || Number(raw) < min || Number(raw) > max) return invalid(name);
    return Number(raw);
  };
  const allowedHosts = [...new Set(read('CHAT_OLLAMA_ALLOWED_HOSTS').split(',').map(value => value.trim().toLowerCase()).filter(Boolean))];
  if (allowedHosts.length > 8 || allowedHosts.some(host => host.length > 253 || isIP(host) || !host.split('.').every(label => /^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/i.test(label)))) invalid('CHAT_OLLAMA_ALLOWED_HOSTS');
  let url: URL;
  try { url = new URL(read('CHAT_OLLAMA_URL') || 'http://127.0.0.1:11434'); } catch { return invalid('CHAT_OLLAMA_URL'); }
  const host = url.hostname.replace(/^\[|\]$/g, '').toLowerCase();
  if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password || url.pathname !== '/' || url.search || url.hash ||
    (!isPrivateChatAddress(host) && !['localhost', 'ollama'].includes(host) && !allowedHosts.includes(host))) invalid('CHAT_OLLAMA_URL');
  const model = read('CHAT_OLLAMA_MODEL') || 'physiquequest-phiq';
  if (!/^[a-z0-9][a-z0-9_.-]*(?::[a-z0-9_.-]+)?$/i.test(model) || /cloud/i.test(model)) invalid('CHAT_OLLAMA_MODEL');
  const keepAlive = read('CHAT_KEEP_ALIVE') || '30m';
  const duration = /^(\d+)(s|m|h)$/.exec(keepAlive);
  const keepAliveSeconds = keepAlive === '-1' ? -1 : keepAlive === '0' ? 0 : duration ? Number(duration[1]) * ({ s: 1, m: 60, h: 3600 }[duration[2]] ?? 0) : NaN;
  if (!Number.isSafeInteger(keepAliveSeconds) || keepAliveSeconds < -1 || keepAliveSeconds > 86400) invalid('CHAT_KEEP_ALIVE');
  const warmup = read('CHAT_WARMUP_ENABLED');
  if (warmup && !['true', 'false'].includes(warmup)) invalid('CHAT_WARMUP_ENABLED');
  return {
    url: url.origin, hostname: host, model, timeoutMs: integer('CHAT_TIMEOUT_MS', 50000, 1000, 55000),
    keepAlive, keepAliveSeconds, maxOutputTokens: integer('CHAT_MAX_OUTPUT_TOKENS', 384, 64, 2048),
    contextTokens: integer('CHAT_CONTEXT_TOKENS', 8192, 2048, 32768),
    maxConcurrency: integer('CHAT_MAX_CONCURRENCY', 2, 1, 16),
    modelCheckTtlMs: integer('CHAT_MODEL_CHECK_TTL_MS', 30000, 0, 60000),
    warmupEnabled: warmup ? warmup === 'true' : read('NODE_ENV') === 'production',
    warmupTimeoutMs: integer('CHAT_WARMUP_TIMEOUT_MS', 180000, 1000, 300000),
  };
}
