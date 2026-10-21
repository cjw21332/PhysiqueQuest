import { Injectable, HttpException, type CanActivate, type ExecutionContext } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { createHash } from 'node:crypto';
import { Model } from 'mongoose';
import { AuthRateLimit } from './auth-rate-limit.schema.js';

@Injectable()
export class AuthThrottleGuard implements CanActivate {
  constructor(@InjectModel(AuthRateLimit.name) private readonly limits: Model<AuthRateLimit>) {}
  async canActivate(context: ExecutionContext) {
    const req = context.switchToHttp().getRequest();
    const path = String(req.route?.path ?? req.url.split('?')[0]).replace(/\/+$/, '').toLowerCase();
    if (req.method !== 'POST' || !/^\/api\/(?:v1\/)?(?:account\/recover|auth\/(?:login|register|verification\/(?:request|confirm)|session\/(?:login|register|refresh|migrate))|pose\/analyze)$/.test(path)) return true;
    const refresh = path.endsWith('/refresh');
    const keys: Array<[string, number]> = [[`ip:${req.ip}`, refresh ? 120 : 30]];
    if (typeof req.body?.email === 'string') keys.push([`email:${req.body.email.trim().toLowerCase()}`, 10]);
    for (const [identity, maximum] of keys) {
      const bucket = Math.floor(Date.now() / 60_000);
      const filter = { _id: createHash('sha256').update(`auth:${refresh ? 'refresh' : path.includes('/pose/') ? 'pose' : 'login'}:${identity}:${bucket}`).digest('hex') };
      const update = { $inc: { hits: 1 }, $setOnInsert: { expiresAt: new Date((bucket + 2) * 60_000) } };
      const result = await this.limits.findOneAndUpdate(filter, update, { upsert: true, returnDocument: 'after' }).catch(async (error: { code?: number }) => {
        if (error.code !== 11000) throw error;
        return this.limits.findOneAndUpdate(filter, update, { returnDocument: 'after' });
      });
      if (!result || result.hits > maximum) {
        context.switchToHttp().getResponse().setHeader('Retry-After', '60');
        throw new HttpException('Too many attempts. Try again later.', 429);
      }
    }
    return true;
  }
}
