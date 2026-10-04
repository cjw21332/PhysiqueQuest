/**
 * Redaction helpers.
 *
 * Two rules drive this module:
 *  1. Secrets are never written to logs. Tokens and API keys are replaced with a
 *     fixed marker so a log line is still correlatable without being usable.
 *  2. Caller-supplied blobs are truncated. An `image` field is a base64 photo,
 *     which is both enormous and a piece of user data; it must never reach the
 *     log stream even at debug level.
 */

export const REDACTED = '[redacted]';

/** C0 (0x00-0x1f) and C1 (0x7f-0x9f) control code points. */
function isControlCode(code: number): boolean {
  return code <= 0x1f || (code >= 0x7f && code <= 0x9f);
}

const MAX_STRING_LENGTH = 256;

/** Keys whose values are replaced wholesale wherever they appear in a log payload. */
const SECRET_KEYS = new Set(
  [
    'authorization',
    'proxy-authorization',
    'cookie',
    'set-cookie',
    'x-internal-api-key',
    'apikey',
    'api_key',
    'api-key',
    'token',
    'secret',
    'password',
    'image',
    'data',
    'inlineData',
    'bytes',
    'buffer',
  ].map((k) => k.toLowerCase())
);

/** Keys that must never be logged at all, even truncated: derived key material. */
export function isSecretKey(key: string): boolean {
  return SECRET_KEYS.has(key.toLowerCase());
}

/** Trims a caller-supplied string to a bounded, control-character-free form. */
export function safeString(value: unknown, max = MAX_STRING_LENGTH): string {
  let s = typeof value === 'string' ? value : String(value ?? '');
  // Replace control characters with spaces so a hostile value cannot forge log
  // lines. Checked by code point to keep the intent explicit.
  let needsScrub = false;
  for (let i = 0; i < s.length; i++) {
    if (isControlCode(s.charCodeAt(i))) {
      needsScrub = true;
      break;
    }
  }
  if (needsScrub) {
    s = Array.from(s, (ch) => (isControlCode(ch.codePointAt(0) ?? 0) ? ' ' : ch)).join('');
  }
  if (s.length > max) s = `${s.slice(0, max)}...[truncated ${s.length - max} chars]`;
  return s;
}

/**
 * Deep-clones a value into a log-safe shape, redacting secret keys and bounding
 * array length and depth so a hostile payload cannot bloat or recurse the
 * logger. Cycles are broken with "[circular]".
 */
export function redact(value: unknown, depth = 0, seen = new WeakSet<object>()): unknown {
  if (value === null || value === undefined) return value;
  if (typeof value === 'string') return safeString(value);
  if (typeof value === 'number' || typeof value === 'boolean') return value;
  if (typeof value === 'bigint') return value.toString();
  if (typeof value === 'function' || typeof value === 'symbol') return undefined;
  if (value instanceof Error) {
    return { name: value.name, message: safeString(value.message) };
  }
  if (depth >= 6) return '[max depth]';
  if (typeof value === 'object') {
    if (seen.has(value)) return '[circular]';
    seen.add(value);
    if (Array.isArray(value)) {
      const head = value.slice(0, 20).map((v) => redact(v, depth + 1, seen));
      return value.length > 20 ? [...head, `[+${value.length - 20} more]`] : head;
    }
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      out[k] = isSecretKey(k) ? REDACTED : redact(v, depth + 1, seen);
    }
    return out;
  }
  return String(value);
}

/**
 * Strips credentials and query strings from a URL so it can be logged.
 * The USDA API requires its key as a `?api_key=` query parameter, so every
 * upstream URL we touch is a secret in transit through logs and proxies.
 */
export function safeUrl(raw: string): string {
  try {
    const u = new URL(raw);
    u.username = '';
    u.password = '';
    u.search = '';
    u.hash = '';
    return u.toString();
  } catch {
    return '[unparseable url]';
  }
}