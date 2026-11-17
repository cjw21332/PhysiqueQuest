import { CanActivate, ExecutionContext, HttpException, Injectable, ServiceUnavailableException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { createHash } from 'node:crypto';
import { Model } from 'mongoose';
import { AuthRateLimit } from '../auth/auth-rate-limit.schema.js';
import { consumeQuota } from '../privacy/lifecycle-quota.js';

// Shared database buckets cover both ordinary and administrator launches across replicas.
@Injectable()
export class PoseTrackerRateLimitGuard implements CanActivate {
  constructor(@InjectModel(AuthRateLimit.name) private readonly limits: Model<AuthRateLimit>) {}
  async canActivate(context: ExecutionContext) {
    const http = context.switchToHttp(), req = http.getRequest();
    if (typeof req.user?.userId !== 'string' || !req.user.userId || typeof req.ip !== 'string' || !req.ip) {
      throw new ServiceUnavailableException('PoseTracker launch is temporarily unavailable.');
    }
    const now = Date.now(), window = Math.floor(now / 60_000);
    const identities = [[`user:${req.user.userId}`, 10], [`ip:${req.ip}`, 30]] as const;
    let counts: number[];
    try {
      counts = await consumeQuota(this.limits.db, req.user.userId, identities.map(([identity]) => ({
        id: createHash('sha256').update(`pose-tracker:${identity}:${window}`).digest('hex'), owned: identity.startsWith('user:'), expiresAt: new Date((window + 2) * 60000),
      })), req.user.lifecycleGeneration);
    } catch { throw new ServiceUnavailableException('PoseTracker launch is temporarily unavailable.'); }
    for (const [index, [, maximum]] of identities.entries()) {
      const hits = counts[index];
      if (hits > maximum) {
        http.getResponse().setHeader('Retry-After', String(60 - Math.floor(now / 1000) % 60));
        throw new HttpException('Too many PoseTracker launch requests. Try again later.', 429);
      }
    }
    return true;
  }
}
