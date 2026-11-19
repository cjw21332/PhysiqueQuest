import { HttpException, Injectable, Optional, ServiceUnavailableException, type CanActivate, type ExecutionContext } from '@nestjs/common';
import { InjectConnection } from '@nestjs/mongoose';
import { createHash } from 'node:crypto';
import type { Connection } from 'mongoose';
import { consumeQuota } from '../privacy/lifecycle-quota.js';

/** Shared across authenticated AI routes and backend instances; fails closed without the quota store. */
@Injectable()
export class AiRateLimitGuard implements CanActivate {
  private indexReady?: Promise<unknown>;
  constructor(@Optional() @InjectConnection() private readonly connection?: Connection) {}
  async canActivate(context: ExecutionContext): Promise<boolean> {
    const http = context.switchToHttp(), req = http.getRequest(), res = http.getResponse();
    if (!this.connection?.db || !req.user?.userId) throw new ServiceUnavailableException('AI request limits are temporarily unavailable.');
    const readLimit = (name: string, fallback: number) => {
      const raw = process.env[name];
      if (!raw) return fallback;
      const value = Number(raw);
      if (!Number.isSafeInteger(value) || value < 1 || value > 100000) throw new ServiceUnavailableException('AI request limits are not configured correctly.');
      return value;
    };
    const perUser = readLimit('AI_RATE_LIMIT_PER_USER_HOUR', 30), total = readLimit('AI_RATE_LIMIT_GLOBAL_DAY', 500);
    const now = Date.now(), hour = Math.floor(now / 3600000), day = Math.floor(now / 86400000);
    const hash = (value: string) => createHash('sha256').update(value).digest('hex');
    let counts: number[];
    try {
      this.indexReady ??= this.connection.db.collection('auth_rate_limits').createIndex({ expiresAt: 1 }, { expireAfterSeconds: 0, maxTimeMS: 2000 });
      await this.indexReady;
      counts = await consumeQuota(this.connection, req.user.userId, [
        { id: hash(`ai:user:${req.user.userId}:${hour}`), owned: true, expiresAt: new Date((hour + 2) * 3600000) },
        { id: hash(`ai:global:${day}`), owned: false, expiresAt: new Date((day + 2) * 86400000) },
      ], req.user.lifecycleGeneration);
    } catch { this.indexReady = undefined; throw new ServiceUnavailableException('AI request limits are temporarily unavailable.'); }
    if (counts[0] > perUser || counts[1] > total) {
      const reset = counts[1] > total ? (day + 1) * 86400000 : (hour + 1) * 3600000;
      res.setHeader('Retry-After', String(Math.max(1, Math.ceil((reset - now) / 1000))));
      throw new HttpException('AI request limit reached. Please try again later.', 429);
    }
    return true;
  }
}
