import { Injectable, Optional, type CanActivate, type ExecutionContext } from '@nestjs/common';
import { InjectConnection } from '@nestjs/mongoose';
import { createHash } from 'node:crypto';
import type { Connection } from 'mongoose';
import { FoodScanConfigService } from './foodscan-config.js';
import { rateLimited, serviceUnavailable } from './errors.js';
import { PinoLogger } from './pino-logger.js';
import type { ScanRequest } from './scan-request.js';
import { consumeQuota } from '../../privacy/lifecycle-quota.js';

/** MongoDB atomic fixed-window buckets shared by all backend instances. */
@Injectable()
export class ScanRateLimitGuard implements CanActivate {
  private indexReady?: Promise<unknown>;
  constructor(private readonly config: FoodScanConfigService, private readonly logger: PinoLogger,
    @Optional() @InjectConnection() private readonly connection?: Connection) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const { rateLimit } = this.config.value;
    if (!rateLimit.enabled) return true;
    const http = context.switchToHttp(), req = http.getRequest<ScanRequest>();
    const res = http.getResponse<{ setHeader(name: string, value: string): void }>();
    if (!req.user?.userId || !this.connection?.db) throw serviceUnavailable('Food scanner limits are temporarily unavailable');
    const now = Date.now(), window = Math.floor(now / rateLimit.windowMs), resetAt = (window + 1) * rateLimit.windowMs;
    const id = createHash('sha256').update(`foodscan:${req.user.userId}:${rateLimit.windowMs}:${window}`).digest('hex');
    const collection = this.connection.db.collection<{ _id: string; hits: number; expiresAt: Date }>('auth_rate_limits');
    let count: number;
    try {
      this.indexReady ??= collection.createIndex({ expiresAt: 1 }, { expireAfterSeconds: 0, maxTimeMS: 2000 });
      await this.indexReady;
      [count] = await consumeQuota(this.connection, req.user.userId, [{ id, owned: true, expiresAt: new Date(resetAt + rateLimit.windowMs) }], req.user.lifecycleGeneration);
    } catch {
      this.indexReady = undefined;
      throw serviceUnavailable('Food scanner limits are temporarily unavailable');
    }
    const retry = Math.max(1, Math.ceil((resetAt - now) / 1000));
    res.setHeader('X-RateLimit-Limit', String(rateLimit.max));
    res.setHeader('X-RateLimit-Remaining', String(Math.max(0, rateLimit.max - count)));
    res.setHeader('X-RateLimit-Reset', String(retry));
    if (count > rateLimit.max) {
      this.logger.event('warn', { event: 'rate_limited', request_id: req.requestId, path: req.path, retry_after_s: retry }, 'caller exceeded rate limit');
      throw rateLimited('Caller exceeded the request rate limit', retry);
    }
    return true;
  }
}
