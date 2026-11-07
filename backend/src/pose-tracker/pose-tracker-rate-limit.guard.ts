import { CanActivate, ExecutionContext, HttpException, Injectable, ServiceUnavailableException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { createHash } from 'node:crypto';
import { Model } from 'mongoose';
import { AuthRateLimit } from '../auth/auth-rate-limit.schema.js';

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
    for (const [identity, maximum] of [[`user:${req.user.userId}`, 10], [`ip:${req.ip}`, 30]] as const) {
      const filter = { _id: createHash('sha256').update(`pose-tracker:${identity}:${window}`).digest('hex') };
      const update = { $inc: { hits: 1 }, $setOnInsert: { expiresAt: new Date((window + 2) * 60_000) } };
      let result: AuthRateLimit | null;
      try {
        result = await this.limits.findOneAndUpdate(filter, update, { upsert:true, returnDocument:'after', maxTimeMS:2000 }).catch(async (error: {code?:number}) => {
          if (error.code !== 11000) throw error;
          return this.limits.findOneAndUpdate(filter, update, { returnDocument:'after', maxTimeMS:2000 });
        });
      } catch { throw new ServiceUnavailableException('PoseTracker launch is temporarily unavailable.'); }
      if (!result || result.hits > maximum) {
        http.getResponse().setHeader('Retry-After', String(60 - Math.floor(now / 1000) % 60));
        throw new HttpException('Too many PoseTracker launch requests. Try again later.', 429);
      }
    }
    return true;
  }
}
