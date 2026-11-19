import { AsyncLocalStorage } from 'node:async_hooks';
import { Injectable, type CallHandler, type ExecutionContext, type NestInterceptor } from '@nestjs/common';
import { Observable } from 'rxjs';

export const lifecycleContext = new AsyncLocalStorage<{ userId: string; generation: number }>();

/** Carries the generation authenticated at request entry across delayed work. */
@Injectable()
export class LifecycleContextInterceptor implements NestInterceptor {
  intercept(context: ExecutionContext, next: CallHandler) {
    const user = context.switchToHttp().getRequest().user;
    if (!user || !Number.isSafeInteger(user.lifecycleGeneration)) return next.handle();
    return new Observable(subscriber => lifecycleContext.run({ userId: user.userId, generation: user.lifecycleGeneration }, () => next.handle().subscribe(subscriber)));
  }
}
