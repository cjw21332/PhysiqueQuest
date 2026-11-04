import { HttpException, Injectable, Optional, ServiceUnavailableException, type CanActivate, type ExecutionContext } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { createHash } from 'node:crypto';
import { Model } from 'mongoose';
import { AuthRateLimit } from '../auth/auth-rate-limit.schema.js';

@Injectable()
export class ChatRateLimitGuard implements CanActivate {
  private readonly buckets = new Map<string, { hits: number; resetAt: number }>();
  constructor(@Optional() @InjectModel(AuthRateLimit.name) private readonly limits?: Model<AuthRateLimit>) {}
  async canActivate(context: ExecutionContext) {
    const http = context.switchToHttp(), req = http.getRequest();
    const now = Date.now();
    if (this.limits) {
      const window = Math.floor(now / 60000);
      for (const [identity, maximum] of [[`user:${req.user?.userId}`, 10], [`ip:${req.ip ?? 'unknown'}`, 30]] as const) {
        const filter = { _id: createHash('sha256').update(`chat:${identity}:${window}`).digest('hex') };
        const update = { $inc: { hits: 1 }, $setOnInsert: { expiresAt: new Date((window + 2) * 60000) } };
        let result: AuthRateLimit | null;
        try {
          result = await this.limits.findOneAndUpdate(filter, update, { upsert: true, returnDocument: 'after', maxTimeMS: 2000 }).catch(async (error: { code?: number }) => {
            if (error.code !== 11000) throw error;
            return this.limits!.findOneAndUpdate(filter, update, { returnDocument: 'after', maxTimeMS: 2000 });
          });
        } catch { throw new ServiceUnavailableException('Phiq is temporarily unavailable. Try again shortly.'); }
        if (!result || result.hits > maximum) {
          http.getResponse().setHeader('Retry-After', String(60 - Math.floor(now / 1000) % 60));
          throw new HttpException('Too many Phiq requests. Try again shortly.', 429);
        }
      }
      return true;
    }
    // The real ChatModule always injects the shared MongoDB store. A missing
    // store must not silently weaken production limits across replicas.
    if (process.env.NODE_ENV === 'production') throw new ServiceUnavailableException('Phiq is temporarily unavailable.');
    for (const [key, bucket] of this.buckets) if (bucket.resetAt <= now) this.buckets.delete(key);
    for (const [key, max] of [[`user:${req.user?.userId}`, 10], [`ip:${req.ip ?? 'unknown'}`, 30]] as const) {
      let bucket = this.buckets.get(key);
      if (!bucket) {
        if (this.buckets.size >= 10000) throw new HttpException('Phiq is busy. Try again shortly.', 429);
        bucket = { hits: 0, resetAt: now + 60000 }; this.buckets.set(key, bucket);
      }
      if (++bucket.hits > max) {
        http.getResponse().setHeader('Retry-After', String(Math.max(1, Math.ceil((bucket.resetAt - now) / 1000))));
        throw new HttpException('Too many Phiq requests. Try again shortly.', 429);
      }
    }
    return true;
  }
}
