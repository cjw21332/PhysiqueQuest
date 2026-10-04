import { ConfigService } from '@nestjs/config';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { buildFoodScanConfig } from './foodscan-config.js';

/**
 * The scanner no longer owns a shared secret, so these tests cover only what
 * still has to fail loudly: a nonsense byte budget or timeout would serve broken
 * scans rather than failing. Missing provider credentials must NOT throw, because
 * the same process serves auth, profile and nutrition traffic.
 */

const MANAGED_KEYS = [
  'GEMINI_API_KEY',
  'GEMINI_MODEL',
  'GEMINI_THINKING_LEVEL',
  'GEMINI_ATTEMPTS',
  'USDA_API_KEY',
  'USDA_BASE',
  'LOG_LEVEL',
  'TRUST_PROXY_HOPS',
  'FOODSCAN_MAX_IMAGE_BYTES',
  'FOODSCAN_MAX_BODY_BYTES',
  'FOODSCAN_MAX_SEARCH_QUERY_LENGTH',
  'FOODSCAN_MAX_DETECTED_ITEMS',
  'FOODSCAN_REQUEST_TIMEOUT_MS',
  'FOODSCAN_UPSTREAM_TIMEOUT_MS',
  'FOODSCAN_RATE_LIMIT_ENABLED',
  'FOODSCAN_RATE_LIMIT_MAX',
  'FOODSCAN_RATE_LIMIT_WINDOW_MS',
] as const;

let saved: Record<string, string | undefined>;

/**
 * How long the mobile client waits before abandoning a scan and offering a
 * retry, mirrored from `SCAN_TIMEOUT_MS` in `frontend/lib/api.ts`. Kept as a
 * literal rather than imported: the two live in separate deployments, so this
 * is a contract check that fails loudly when one side moves on its own.
 *
 * Only the ordering matters here. The client's cap is generous by design, and
 * the server is expected to answer well inside it with a specific reason.
 */
const CLIENT_SCAN_CAP_MS = 60_000;

beforeEach(() => {
  saved = Object.fromEntries(MANAGED_KEYS.map((k) => [k, process.env[k]]));
  for (const k of MANAGED_KEYS) delete process.env[k];
});

afterEach(() => {
  for (const k of MANAGED_KEYS) {
    if (saved[k] === undefined) delete process.env[k];
    else process.env[k] = saved[k];
  }
});

/** Builds config straight from a controlled environment, no module cache involved. */
function loadWith(env: Record<string, string | undefined> = {}) {
  for (const k of MANAGED_KEYS) delete process.env[k];
  Object.assign(process.env, env);
  return buildFoodScanConfig(new ConfigService());
}

describe('food scan configuration', () => {
  it('boots with no provider credentials at all', () => {
    const config = loadWith();
    expect(config.gemini.configured).toBe(false);
    expect(config.usda.configured).toBe(false);
  });

  it('defaults the reasoning effort and attempt count to values that finish', () => {
    // Measured against gemini-3.5-flash with structured output: the default
    // reasoning level answered in ~4s where the unset one took ~9s and overran
    // the upstream budget.
    const config = loadWith({ GEMINI_API_KEY: 'gemini-secret' });
    expect(config.gemini.thinkingLevel).toBe('LOW');
    expect(config.gemini.attempts).toBe(3);
    expect(config.requestTimeoutMs).toBeGreaterThan(config.upstreamTimeoutMs);
  });

  it('answers before the mobile client stops waiting', () => {
    // The client abandons a scan at 30s. A deadline above that leaves the
    // server working on a result nobody will read, so the two numbers are a
    // contract rather than two independent tuning knobs.
    expect(loadWith({}).requestTimeoutMs).toBeLessThan(CLIENT_SCAN_CAP_MS);
  });

  it('still honours a request deadline raised above the client cap', () => {
    // An operator may legitimately override it; the guard is about the default
    // drifting, not about forbidding a deliberate choice.
    const config = loadWith({ FOODSCAN_REQUEST_TIMEOUT_MS: '60000' });
    expect(config.requestTimeoutMs).toBe(60_000);
  });

  it('reads the reasoning effort case-insensitively', () => {
    expect(loadWith({ GEMINI_THINKING_LEVEL: 'high' }).gemini.thinkingLevel).toBe('HIGH');
  });

  it('throws on a reasoning effort the provider does not accept', () => {
    expect(() => loadWith({ GEMINI_THINKING_LEVEL: 'TURBO' })).toThrow(/GEMINI_THINKING_LEVEL/);
  });

  it('throws on an attempt count that would disable the scan', () => {
    expect(() => loadWith({ GEMINI_ATTEMPTS: '0' })).toThrow(/GEMINI_ATTEMPTS/);
  });

  it('boots with credentials but no explicit limits', () => {
    const config = loadWith({ GEMINI_API_KEY: 'gemini-secret', USDA_API_KEY: 'usda-secret' });
    expect(config.gemini.configured).toBe(true);
    expect(config.usda.configured).toBe(true);
    expect(config.maxImageBytes).toBe(4 * 1024 * 1024);
  });

  it('defaults the vision model to gemini-3.6-flash', () => {
    // gemini-3.5-flash was answering half its vision calls with 503 and taking
    // 13-14s on the rest, so the default moved to the generation that returned
    // no failures across four samples at 2-12.5s.
    expect(loadWith().gemini.model).toBe('gemini-3.6-flash');
  });

  it('does not pin the vision model to the retired 2.5 generation', () => {
    expect(loadWith().gemini.model).not.toMatch(/2\.5/);
  });

  it('derives the JSON body limit from the image limit', () => {
    const config = loadWith({ FOODSCAN_MAX_IMAGE_BYTES: '1000000' });
    // base64 expands by 4/3, plus slack for the JSON envelope.
    expect(config.maxBodyBytes).toBeGreaterThan(Math.ceil((1_000_000 * 4) / 3));
  });

  it('rejects a body limit too small to carry the image', () => {
    // The silent failure this prevents is every scan answering 413.
    expect(() =>
      loadWith({ FOODSCAN_MAX_IMAGE_BYTES: '4000000', FOODSCAN_MAX_BODY_BYTES: '2048' })
    ).toThrow(/FOODSCAN_MAX_BODY_BYTES/);
  });

  it('reports every configuration problem at once', () => {
    let message = '';
    try {
      loadWith({ FOODSCAN_MAX_IMAGE_BYTES: '-1', TRUST_PROXY_HOPS: 'lots' });
    } catch (e) {
      message = (e as Error).message;
    }
    expect(message).toContain('FOODSCAN_MAX_IMAGE_BYTES');
    expect(message).toContain('TRUST_PROXY_HOPS');
  });

  describe('numeric validation', () => {
    it('throws on a non-integer value', () => {
      expect(() => loadWith({ FOODSCAN_MAX_IMAGE_BYTES: 'lots' })).toThrow(/FOODSCAN_MAX_IMAGE_BYTES/);
    });

    it('throws on a negative size limit', () => {
      expect(() => loadWith({ FOODSCAN_MAX_IMAGE_BYTES: '-1' })).toThrow(/FOODSCAN_MAX_IMAGE_BYTES/);
    });

    it('throws on an absurdly large size limit', () => {
      expect(() => loadWith({ FOODSCAN_MAX_IMAGE_BYTES: '999999999' })).toThrow(/FOODSCAN_MAX_IMAGE_BYTES/);
    });

    it('throws on a zero timeout, which would abort every request', () => {
      expect(() => loadWith({ FOODSCAN_REQUEST_TIMEOUT_MS: '0' })).toThrow(/FOODSCAN_REQUEST_TIMEOUT_MS/);
    });

    it('throws when the detected-item cap is out of range', () => {
      expect(() => loadWith({ FOODSCAN_MAX_DETECTED_ITEMS: '500' })).toThrow(/FOODSCAN_MAX_DETECTED_ITEMS/);
    });
  });

  it('does not trust X-Forwarded-For unless told how many proxies to trust', () => {
    expect(loadWith().trustProxyHops).toBe(0);
  });

  it('accepts an explicit proxy hop count', () => {
    expect(loadWith({ TRUST_PROXY_HOPS: '1' }).trustProxyHops).toBe(1);
  });

  it('defaults rate limiting on', () => {
    const config = loadWith();
    expect(config.rateLimit.enabled).toBe(true);
    expect(config.rateLimit.max).toBe(60);
  });

  it('allows rate limiting to be switched off explicitly', () => {
    expect(loadWith({ FOODSCAN_RATE_LIMIT_ENABLED: 'false' }).rateLimit.enabled).toBe(false);
  });

  it('strips trailing slashes from the USDA base URL', () => {
    expect(loadWith({ USDA_BASE: 'https://example.test/fdc/v1//' }).usda.base).toBe('https://example.test/fdc/v1');
  });

  it('treats a whitespace-only key as unconfigured', () => {
    expect(loadWith({ GEMINI_API_KEY: '   ' }).gemini.configured).toBe(false);
  });
});
