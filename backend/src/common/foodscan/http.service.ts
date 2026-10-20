import { Injectable } from '@nestjs/common';
import { FoodScanConfigService } from './foodscan-config.js';
import { AppError, ErrorCode, upstreamTimeout, upstreamUnavailable } from './errors.js';
import { safeUrl } from './redact.js';

export interface FetchJsonOptions {
  upstream: string;
  method?: 'GET' | 'POST';
  body?: string;
  timeoutMs?: number;
  headers?: Record<string, string>;
  retryServerErrors?: boolean;
}

@Injectable()
export class HttpService {
  constructor(private readonly config: FoodScanConfigService) {}

  /**
   * Every outbound call to Gemini or USDA goes through here so that no request
   * can hang indefinitely. Without this, a slow upstream would hold the inbound
   * request open with no deadline at all.
   */
  async fetchJson<T>(url: string, opts: FetchJsonOptions): Promise<T> {
    const timeoutMs = opts.timeoutMs ?? this.config.value.upstreamTimeoutMs;
    const target = safeUrl(url);

    let res: Response;
    try {
      res = await fetch(url, {
        method: opts.method ?? 'GET',
        ...(opts.body === undefined ? {} : { body: opts.body }),
        headers: { accept: 'application/json', ...opts.headers },
        signal: AbortSignal.timeout(timeoutMs),
      });
    } catch (cause) {
      if (isTimeout(cause)) {
        throw upstreamTimeout(opts.upstream);
      }
      // The cause can embed the request URL, which for USDA contains the API key.
      throw upstreamUnavailable(
        opts.upstream,
        `${opts.upstream} request to ${target} failed: ${describe(cause)}`,
        cause
      );
    }

    if (!res.ok) {
      // Read and discard the body: it is not surfaced to the caller, and leaving
      // it unread can keep the socket open.
      await res.text().catch(() => '');
      if (opts.retryServerErrors && [500, 502, 503, 504].includes(res.status)) {
        await new Promise((resolve) => setTimeout(resolve, 200));
        return this.fetchJson<T>(url, { ...opts, retryServerErrors: false });
      }
      if (res.status === 404) {
        throw new AppError(ErrorCode.NOT_FOUND, `${opts.upstream} has no record for that identifier`);
      }
      if (res.status === 429) {
        throw new AppError(ErrorCode.PROVIDER_RATE_LIMITED, `${opts.upstream} is busy right now. Wait a moment, then try again.`, {
          details: { upstream: opts.upstream },
        });
      }
      throw upstreamUnavailable(opts.upstream, `${opts.upstream} returned ${res.status} for ${target}`);
    }

    try {
      return (await res.json()) as T;
    } catch (cause) {
      throw new AppError(ErrorCode.UPSTREAM_UNAVAILABLE, `${opts.upstream} returned a response that could not be parsed`, {
        details: { upstream: opts.upstream },
        logMessage: `unparseable JSON from ${target}`,
        cause,
      });
    }
  }
}

function isTimeout(err: unknown): boolean {
  if (err instanceof Error) {
    if (
      err.name === 'TimeoutError' ||
      err.name === 'AbortError' ||
      (err as any).name === 'TimeoutError' ||
      (err as any).code === 'ETIMEDOUT' ||
      err.message.includes('timeout')
    ) {
      return true;
    }
  }
  return false;
}

function describe(err: unknown): string {
  if (err instanceof Error) return `${err.name}: ${err.message}`;
  return String(err);
}

/**
 * Runs tasks with bounded concurrency, failing fast on the first rejection.
 *
 * Awaiting each USDA lookup in a serial loop made an eight-item photo cost
 * sixteen sequential round trips. This runs the same work concurrently without
 * letting a single image open an unbounded number of sockets.
 */
export async function mapConcurrent<T, R>(
  items: T[],
  limit: number,
  worker: (item: T, index: number) => Promise<R>
): Promise<R[]> {
  const results = Array.from<R>({ length: items.length });
  const width = Math.max(1, Math.min(limit, items.length));
  let cursor = 0;

  async function run(): Promise<void> {
    for (;;) {
      const index = cursor++;
      if (index >= items.length) return;
      results[index] = await worker(items[index], index);
    }
  }

  await Promise.all(Array.from({ length: width }, run));
  return results;
}
