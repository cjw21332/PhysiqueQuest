import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

/**
 * Thrown when configuration is missing or out of range. Failing at boot is
 * deliberate: a backend that starts with an unusable Gemini model identifier or
 * a nonsense byte budget would serve broken scans instead of refusing to start.
 */
export class ConfigError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ConfigError';
  }
}

function intVar(
  name: string,
  raw: string | undefined,
  fallback: number,
  opts: { min?: number; max?: number } = {}
): number {
  if (raw === undefined || raw.trim() === '') return fallback;
  const parsed = Number(raw);
  if (!Number.isInteger(parsed)) {
    throw new ConfigError(`${name} must be an integer, got ${JSON.stringify(raw)}`);
  }
  if (opts.min !== undefined && parsed < opts.min) {
    throw new ConfigError(`${name} must be >= ${opts.min}, got ${parsed}`);
  }
  if (opts.max !== undefined && parsed > opts.max) {
    throw new ConfigError(`${name} must be <= ${opts.max}, got ${parsed}`);
  }
  return parsed;
}

const DEFAULT_MAX_IMAGE_BYTES = 4 * 1024 * 1024;
const DEFAULT_MAX_SEARCH_QUERY_LENGTH = 120;
const DEFAULT_MAX_DETECTED_ITEMS = 12;
/**
 * Budget for the whole scan, which is one vision call plus a bounded USDA fan-out.
 * It must stay comfortably above `DEFAULT_UPSTREAM_TIMEOUT_MS` plus one vision
 * retry, otherwise the request deadline fires while a retry is still in flight.
 *
 * It must also stay *below* the 60s the mobile client waits before abandoning a
 * scan. A deadline above that cap means the user gives up while the server is
 * still working, so the provider is still paid for a result nobody will see and
 * an immediate retry runs a second scan on top of the first.
 */
const DEFAULT_REQUEST_TIMEOUT_MS = 25_000;
/**
 * Per-attempt vision budget. Measured with structured output at
 * `thinkingLevel: LOW`, a healthy vision call lands around 2-4s, so 10s left no
 * room for a provider that was slow but not hung and turned healthy scans into
 * 504s.
 */
const DEFAULT_UPSTREAM_TIMEOUT_MS = 20_000;
/**
 * Default vision model.
 *
 * Measured over four samples apiece while `gemini-3.5-flash` was degraded, that
 * model failed roughly half its calls with 503 "high demand" and took 13-14s on
 * the ones that succeeded. `gemini-3.6-flash` returned no failures across the
 * same samples at 2-12.5s, which fits the per-attempt budget with room for a
 * retry. Override with `GEMINI_MODEL` to change it without a code change.
 */
const DEFAULT_GEMINI_MODEL = 'gemini-3.6-flash';

export const GEMINI_THINKING_LEVELS = ['MINIMAL', 'LOW', 'MEDIUM', 'HIGH'] as const;
export type GeminiThinkingLevel = (typeof GEMINI_THINKING_LEVELS)[number];
const DEFAULT_GEMINI_THINKING_LEVEL: GeminiThinkingLevel = 'LOW';
const DEFAULT_GEMINI_ATTEMPTS = 3;

function enumVar<T extends string>(name: string, raw: string | undefined, allowed: readonly T[], fallback: T): T {
  if (raw === undefined || raw.trim() === '') return fallback;
  const value = raw.trim().toUpperCase();
  const match = allowed.find((option) => option === value);
  if (!match) {
    throw new ConfigError(`${name} must be one of ${allowed.join(', ')}, got ${JSON.stringify(raw)}`);
  }
  return match;
}

export interface FoodScanConfig {
  logLevel: string;
  /**
   * Number of trusted reverse-proxy hops to read client IPs from.
   * 0 disables X-Forwarded-For entirely, so a direct client cannot spoof it.
   * The rate limiter falls back to the client IP when there is no user.
   */
  trustProxyHops: number;

  requestTimeoutMs: number;
  upstreamTimeoutMs: number;

  maxImageBytes: number;
  maxBodyBytes: number;
  maxSearchQueryLength: number;
  maxDetectedItems: number;

  rateLimit: {
    enabled: boolean;
    max: number;
    windowMs: number;
  };

  gemini: {
    apiKey: string;
    model: string;
    /**
     * Reasoning effort. The configured models think before answering, and under
     * a structured-output schema that cost roughly 9s per scan, which overran the
     * upstream budget. `LOW` returns the same JSON in about 4s, so the default
     * trades a little deliberation for a request that finishes inside the budget.
     */
    thinkingLevel: GeminiThinkingLevel;
    /** Total attempts per scan, including the first. Retries cover transient 503s. */
    attempts: number;
    configured: boolean;
  };
  usda: {
    apiKey: string;
    base: string;
    configured: boolean;
  };
}

/**
 * Reads and validates the food scan configuration.
 *
 * Absent upstream credentials do NOT throw. The backend has no separate liveness
 * probe to protect, so it must still boot and serve auth, profile and nutrition
 * traffic; only the scan endpoints degrade, returning 503.
 *
 * Note the absence of any shared-secret validation here: the scanner used to be
 * an internal service gated by SERVICE_TOKEN. It now sits behind the same JWT
 * guard as every other endpoint in this backend, so there is no second secret to
 * police.
 */
export function buildFoodScanConfig(config: ConfigService): FoodScanConfig {
  const read = (key: string): string | undefined => config.get<string>(key);
  const problems: string[] = [];

  const safe = <T>(fn: () => T, fallback: T): T => {
    try {
      return fn();
    } catch (e) {
      problems.push((e as Error).message);
      return fallback;
    }
  };

  const geminiKey = (read('GEMINI_API_KEY') ?? '').trim();
  const usdaKey = (read('USDA_API_KEY') ?? '').trim();

  const maxImageBytes = safe(
    () => intVar('FOODSCAN_MAX_IMAGE_BYTES', read('FOODSCAN_MAX_IMAGE_BYTES'), DEFAULT_MAX_IMAGE_BYTES, {
      min: 1024,
      max: 20 * 1024 * 1024,
    }),
    DEFAULT_MAX_IMAGE_BYTES
  );

  // base64 expands binary by 4/3; add slack for the JSON envelope and other
  // fields. Left unset by default so raising the image cap needs no second value.
  const derivedBodyBytes = Math.ceil((maxImageBytes * 4) / 3) + 64 * 1024;
  const maxBodyBytes = safe(
    () =>
      intVar('FOODSCAN_MAX_BODY_BYTES', read('FOODSCAN_MAX_BODY_BYTES'), derivedBodyBytes, {
        min: 1024,
        max: 32 * 1024 * 1024,
      }),
    derivedBodyBytes
  );

  if (maxBodyBytes < derivedBodyBytes) {
    problems.push(
      `FOODSCAN_MAX_BODY_BYTES (${maxBodyBytes}) is below the ${derivedBodyBytes} bytes needed to carry a ` +
        `${maxImageBytes} byte image once base64 encoded. Every scan request would be rejected with 413.`
    );
  }

  const value: FoodScanConfig = {
    logLevel: (read('LOG_LEVEL') ?? 'info').trim(),

    trustProxyHops: safe(
      () => intVar('TRUST_PROXY_HOPS', read('TRUST_PROXY_HOPS'), 0, { min: 0, max: 5 }),
      0
    ),

    requestTimeoutMs: safe(
      () =>
        intVar('FOODSCAN_REQUEST_TIMEOUT_MS', read('FOODSCAN_REQUEST_TIMEOUT_MS'), DEFAULT_REQUEST_TIMEOUT_MS, {
          min: 1_000,
          max: 120_000,
        }),
      DEFAULT_REQUEST_TIMEOUT_MS
    ),

    upstreamTimeoutMs: safe(
      () =>
        intVar(
          'FOODSCAN_UPSTREAM_TIMEOUT_MS',
          read('FOODSCAN_UPSTREAM_TIMEOUT_MS'),
          DEFAULT_UPSTREAM_TIMEOUT_MS,
          { min: 500, max: 60_000 }
        ),
      DEFAULT_UPSTREAM_TIMEOUT_MS
    ),

    maxImageBytes,
    maxBodyBytes,

    maxSearchQueryLength: safe(
      () =>
        intVar(
          'FOODSCAN_MAX_SEARCH_QUERY_LENGTH',
          read('FOODSCAN_MAX_SEARCH_QUERY_LENGTH'),
          DEFAULT_MAX_SEARCH_QUERY_LENGTH,
          { min: 1, max: 500 }
        ),
      DEFAULT_MAX_SEARCH_QUERY_LENGTH
    ),

    // Caps USDA fan-out: each detected item costs up to two upstream calls.
    maxDetectedItems: safe(
      () =>
        intVar('FOODSCAN_MAX_DETECTED_ITEMS', read('FOODSCAN_MAX_DETECTED_ITEMS'), DEFAULT_MAX_DETECTED_ITEMS, {
          min: 1,
          max: 50,
        }),
      DEFAULT_MAX_DETECTED_ITEMS
    ),

    rateLimit: {
      enabled: (read('FOODSCAN_RATE_LIMIT_ENABLED') ?? 'true').toLowerCase() !== 'false',
      max: safe(
        () => intVar('FOODSCAN_RATE_LIMIT_MAX', read('FOODSCAN_RATE_LIMIT_MAX'), 60, { min: 1, max: 100_000 }),
        60
      ),
      windowMs: safe(
        () =>
          intVar('FOODSCAN_RATE_LIMIT_WINDOW_MS', read('FOODSCAN_RATE_LIMIT_WINDOW_MS'), 60_000, {
            min: 1_000,
            max: 3_600_000,
          }),
        60_000
      ),
    },

    gemini: {
      apiKey: geminiKey,
      model: (read('GEMINI_MODEL') ?? DEFAULT_GEMINI_MODEL).trim(),
      thinkingLevel: safe(
        () =>
          enumVar(
            'GEMINI_THINKING_LEVEL',
            read('GEMINI_THINKING_LEVEL'),
            GEMINI_THINKING_LEVELS,
            DEFAULT_GEMINI_THINKING_LEVEL
          ),
        DEFAULT_GEMINI_THINKING_LEVEL
      ),
      attempts: safe(
        () =>
          intVar('GEMINI_ATTEMPTS', read('GEMINI_ATTEMPTS'), DEFAULT_GEMINI_ATTEMPTS, {
            min: 1,
            max: 5,
          }),
        DEFAULT_GEMINI_ATTEMPTS
      ),
      configured: geminiKey.length > 0,
    },

    usda: {
      apiKey: usdaKey,
      base: (read('USDA_BASE') ?? 'https://api.nal.usda.gov/fdc/v1').replace(/\/+$/, ''),
      configured: usdaKey.length > 0,
    },
  };

  if (problems.length > 0) {
    throw new ConfigError(`Invalid food scan configuration:\n  - ${problems.join('\n  - ')}`);
  }

  return value;
}

/**
 * Holds the validated configuration for injection.
 *
 * Built in the constructor rather than in `onModuleInit` so an invalid value
 * surfaces during dependency resolution, before the app accepts a request.
 */
@Injectable()
export class FoodScanConfigService {
  readonly value: FoodScanConfig;

  constructor(config: ConfigService) {
    this.value = buildFoodScanConfig(config);
  }

  get logLevel(): string {
    return this.value.logLevel;
  }

  get maxImageBytes(): number {
    return this.value.maxImageBytes;
  }

  get maxSearchQueryLength(): number {
    return this.value.maxSearchQueryLength;
  }

  get maxDetectedItems(): number {
    return this.value.maxDetectedItems;
  }
}