import { Injectable, type CallHandler, type ExecutionContext, type NestInterceptor } from '@nestjs/common';
import { Observable, lastValueFrom } from 'rxjs';
import { FoodScanConfigService } from './foodscan-config.js';
import { runWithDeadline, type Deadline } from './deadline-context.js';
import { AppError, ErrorCode } from './errors.js';

/**
 * Caps the total time a request may occupy, independent of the per-upstream
 * timeouts. An image with many detected items can otherwise keep a caller
 * waiting through several sequential USDA lookups.
 *
 * The deadline is published as an `AbortSignal` (see `deadline-context.ts`) and
 * fired on expiry, so upstream work is cancelled rather than merely abandoned.
 * An RxJS `timeout` cannot do that: it stops the caller waiting and leaves the
 * handler running, which kept billing the vision provider for a result nobody
 * would receive.
 */
@Injectable()
export class DeadlineInterceptor implements NestInterceptor {
  constructor(private readonly config: FoodScanConfigService) {}

  intercept(_context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const { requestTimeoutMs } = this.config.value;

    return new Observable<unknown>((subscriber) => {
      const controller = new AbortController();
      const deadline: Deadline = {
        signal: controller.signal,
        deadlineAt: Date.now() + requestTimeoutMs,
      };
      let settled = false;

      // Aborting is what actually stops the vision call, so it happens before we
      // answer the caller rather than after.
      const timer = setTimeout(() => {
        if (settled) return;
        settled = true;
        controller.abort();
        subscriber.error(
          new AppError(ErrorCode.TIMEOUT, 'Request exceeded the time budget', {
            details: { timeout_ms: requestTimeoutMs },
          })
        );
      }, requestTimeoutMs);

      // The handler is raced as a plain promise so its cancellation is ours to
      // control. Once we have answered the caller, a late rejection from the
      // cancelled work still has to be observed, or Node reports it as an
      // unhandled rejection and takes the process down.
      const work = runWithDeadline(deadline, () => lastValueFrom(next.handle()));
      work.then(
        (value) => {
          if (settled) return;
          settled = true;
          subscriber.next(value);
          subscriber.complete();
        },
        (err: unknown) => {
          if (settled) return;
          settled = true;
          subscriber.error(err);
        }
      );

      return () => {
        settled = true;
        clearTimeout(timer);
      };
    });
  }
}