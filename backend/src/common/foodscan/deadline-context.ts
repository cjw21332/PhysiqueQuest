import { AsyncLocalStorage } from 'node:async_hooks';

/**
 * Carries the request deadline to the code that actually talks to an upstream
 * provider.
 *
 * The deadline interceptor used to rely on an RxJS `timeout`, which stops the
 * caller waiting but does nothing to the work already in flight: the vision
 * call kept running after the response had been sent, and its `gemini_timeout`
 * landed in the log seconds after `request_failed`. Publishing the signal here
 * lets that work be cancelled for real, and gives the retry loop a clock to
 * budget itself against.
 */
export interface Deadline {
  /** Aborted the moment the request deadline passes. */
  readonly signal: AbortSignal;
  /** Absolute epoch milliseconds at which the request deadline passes. */
  readonly deadlineAt: number;
}

const storage = new AsyncLocalStorage<Deadline>();

/** Runs `fn` with `deadline` visible to it and to anything it awaits. */
export function runWithDeadline<T>(deadline: Deadline, fn: () => T): T {
  return storage.run(deadline, fn);
}

/** The deadline governing the current async flow, if the request has one. */
export function currentDeadline(): Deadline | undefined {
  return storage.getStore();
}

/**
 * Milliseconds left before the deadline, or `Infinity` when the request is not
 * under a deadline and therefore cannot run out of budget.
 */
export function remainingMs(deadline: Deadline | undefined): number {
  return deadline ? deadline.deadlineAt - Date.now() : Number.POSITIVE_INFINITY;
}