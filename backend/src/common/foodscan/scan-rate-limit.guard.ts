import { Injectable, type CanActivate, type ExecutionContext } from '@nestjs/common';
import { FoodScanConfigService } from './foodscan-config.js';
import { rateLimited } from './errors.js';
import { PinoLogger } from './pino-logger.js';
import type { ScanRequest } from './scan-request.js';

interface Bucket {
  count: number;
  resetAt: number;
}

/** Bound memory so unkeyed growth is impossible. */
const MAX_BUCKETS = 10_000;

/**
 * Fixed-window limiter keyed by the authenticated user.
 *
 * This is not a defence against an internet-scale flood. It exists so that one
 * misbehaving client, or one stuck in a retry loop, cannot drain the Gemini and
 * USDA quota that everyone else shares.
 *
 * State is per-process and in-memory. That is adequate for a single instance; a
 * multi-replica deployment would need a shared store.
 */
@Injectable()
export class ScanRateLimitGuard implements CanActivate {
  private readonly buckets = new Map<string, Bucket>();

  constructor(
    private readonly config: FoodScanConfigService,
    private readonly logger: PinoLogger,
  ) {}

  canActivate(context: ExecutionContext): boolean {
    const { rateLimit } = this.config.value;
    if (!rateLimit.enabled) return true;

    const http = context.switchToHttp();
    const req = http.getRequest<ScanRequest>();
    const res = http.getResponse<{ setHeader(name: string, value: string): void }>();

    const now = Date.now();
    const key = req.user?.userId ?? `ip:${req.ip ?? 'unknown'}`;
    let bucket = this.buckets.get(key);

    if (!bucket || bucket.resetAt <= now) {
      if (!bucket && this.buckets.size >= MAX_BUCKETS) {
        for (const [k, v] of this.buckets) {
          if (v.resetAt <= now) this.buckets.delete(k);
          if (this.buckets.size < MAX_BUCKETS) break;
        }
      }
      bucket = { count: 0, resetAt: now + rateLimit.windowMs };
      this.buckets.set(key, bucket);
    }

    bucket.count += 1;

    const remaining = Math.max(0, rateLimit.max - bucket.count);
    res.setHeader('X-RateLimit-Limit', String(rateLimit.max));
    res.setHeader('X-RateLimit-Remaining', String(remaining));
    res.setHeader('X-RateLimit-Reset', String(Math.ceil((bucket.resetAt - now) / 1000)));

    if (bucket.count > rateLimit.max) {
      const retryAfter = Math.max(1, Math.ceil((bucket.resetAt - now) / 1000));
      this.logger.event('warn', {
        event: 'rate_limited',
        request_id: req.requestId,
        user_id: req.user?.userId,
        path: req.path,
        retry_after_s: retryAfter,
      }, 'caller exceeded rate limit');
      // Thrown rather than returned false: a bare false would produce Nest's
      // default 403 body instead of the documented RATE_LIMITED envelope.
      throw rateLimited('Caller exceeded the request rate limit', retryAfter);
    }

    return true;
  }
}