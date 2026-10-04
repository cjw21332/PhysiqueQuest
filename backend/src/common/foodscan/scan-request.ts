import type { Request } from 'express';

/** Identity attached to a request once JwtAuthGuard has run. */
export interface AuthUser {
  userId: string;
}

/**
 * The shape the food scan pipeline expects off an Express request.
 *
 * `userId` is optional because the request context and deadline interceptors run
 * before authentication, and the rate limiter needs a fallback key for anything
 * that reaches it unauthenticated.
 */
export interface ScanRequest extends Request {
  requestId?: string;
  startedAt?: number;
  /** Elapsed milliseconds, stamped by the interceptor once the handler settles. */
  durationMs?: number;
  user?: AuthUser;
}

export const INBOUND_ID_HEADER = 'x-request-id';

/**
 * Correlation ids are echoed into responses and log lines, so restrict them to
 * characters that cannot forge a log entry or split a header.
 */
export const SAFE_REQUEST_ID = /^[A-Za-z0-9._:-]{1,128}$/;

/**
 * Returns a caller-supplied correlation id only when it is safe to reuse, so a
 * hostile header cannot inject content into a log line or a response header.
 */
export function normalizeInboundId(value: unknown): string | undefined {
  if (typeof value !== 'string') return undefined;
  const trimmed = value.trim();
  if (!SAFE_REQUEST_ID.test(trimmed)) return undefined;
  return trimmed;
}