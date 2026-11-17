import { HttpException, Injectable, Optional, ServiceUnavailableException, type CanActivate, type ExecutionContext } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { createHash } from 'node:crypto';
import { Model } from 'mongoose';
import { AuthRateLimit } from '../auth/auth-rate-limit.schema.js';
import { consumeQuota } from '../privacy/lifecycle-quota.js';

@Injectable()
export class ChatRateLimitGuard implements CanActivate {
  constructor(@Optional() @InjectModel(AuthRateLimit.name) private readonly limits?: Model<AuthRateLimit>) {}
  async canActivate(context: ExecutionContext) {
    const http = context.switchToHttp(), req = http.getRequest();
    const now = Date.now();
    if (this.limits) {
      const window = Math.floor(now / 60000);
      const identities = [[`user:${req.user?.userId}`, 10], [`ip:${req.ip ?? 'unknown'}`, 30]] as const;
      let counts: number[];
      try {
        counts = await consumeQuota(this.limits.db, req.user.userId, identities.map(([identity]) => ({
          id: createHash('sha256').update(`chat:${identity}:${window}`).digest('hex'), owned: identity.startsWith('user:'), expiresAt: new Date((window + 2) * 60000),
        })), req.user.lifecycleGeneration);
      } catch { throw new ServiceUnavailableException('Phiq is temporarily unavailable. Try again shortly.'); }
      for (const [index, [, maximum]] of identities.entries()) {
        const hits = counts[index];
        if (hits > maximum) {
          http.getResponse().setHeader('Retry-After', String(60 - Math.floor(now / 1000) % 60));
          throw new HttpException('Too many Phiq requests. Try again shortly.', 429);
        }
      }
      return true;
    }
    // The real ChatModule always injects the shared MongoDB store. A missing
    // store must not silently weaken production limits across replicas.
    throw new ServiceUnavailableException('Phiq is temporarily unavailable.');
  }
}
