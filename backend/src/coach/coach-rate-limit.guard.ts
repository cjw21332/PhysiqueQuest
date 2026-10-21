import { HttpException, Injectable, type CanActivate, type ExecutionContext } from '@nestjs/common';
@Injectable()
export class CoachRateLimitGuard implements CanActivate {
  private readonly buckets = new Map<string, { hits: number; resetAt: number }>();
  canActivate(context: ExecutionContext) {
    const req = context.switchToHttp().getRequest();
    const now = Date.now(), key = `${req.method === 'POST' ? 'write' : 'read'}:${req.ip ?? 'unknown'}`;
    let bucket = this.buckets.get(key);
    if (!bucket || bucket.resetAt <= now) {
      for (const [identity, value] of this.buckets) if (value.resetAt <= now) this.buckets.delete(identity);
      if (this.buckets.size >= 10_000) throw new HttpException('Service is busy. Retry later.', 429);
      bucket = { hits: 0, resetAt: now + 60_000 }; this.buckets.set(key, bucket);
    }
    // shortcut: public Coach limits are per process; use shared edge limits before scaling replicas.
    if (++bucket.hits > (req.method === 'POST' ? 10 : 60)) {
      context.switchToHttp().getResponse().setHeader('Retry-After', '60');
      throw new HttpException('Too many Coach requests. Retry later.', 429);
    }
    return true;
  }
}
