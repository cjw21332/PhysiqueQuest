/**
 * Structured error contract for the food scan endpoints.
 *
 * Every failure leaves these endpoints in exactly one shape:
 *   { "error": { "code", "message", "request_id", "details"? } }
 *
 * `message` is safe to return to the caller. Upstream provider text is logged
 * with full context but never propagated verbatim, because Gemini and USDA
 * errors can embed request URLs (which carry the USDA API key) and internal
 * account details.
 *
 * The envelope is deliberately NOT applied to the rest of the backend: the web
 * client reads `message` and `error` off Nest's default exception shape, so
 * AppExceptionFilter is bound per-controller rather than globally.
 */

export const ErrorCode = {
  INVALID_REQUEST: 'INVALID_REQUEST',
  UNAUTHENTICATED: 'UNAUTHENTICATED',
  NOT_FOUND: 'NOT_FOUND',
  METHOD_NOT_ALLOWED: 'METHOD_NOT_ALLOWED',
  PAYLOAD_TOO_LARGE: 'PAYLOAD_TOO_LARGE',
  UNSUPPORTED_MEDIA_TYPE: 'UNSUPPORTED_MEDIA_TYPE',
  RATE_LIMITED: 'RATE_LIMITED',
  INTERNAL: 'INTERNAL',
  UPSTREAM_UNAVAILABLE: 'UPSTREAM_UNAVAILABLE',
  UPSTREAM_TIMEOUT: 'UPSTREAM_TIMEOUT',
  TIMEOUT: 'TIMEOUT',
  SERVICE_UNAVAILABLE: 'SERVICE_UNAVAILABLE',
  /**
   * A paid upstream refused the call for quota reasons. Distinct from
   * `UPSTREAM_UNAVAILABLE` because the remedy differs: this one clears on its
   * own after a pause, whereas an unavailable provider is not the caller's to
   * fix. Answering 502 would file it as a server fault and invite an immediate
   * retry that is guaranteed to fail the same way.
   */
  PROVIDER_RATE_LIMITED: 'PROVIDER_RATE_LIMITED',
} as const;

export type ErrorCodeValue = (typeof ErrorCode)[keyof typeof ErrorCode];

const STATUS_BY_CODE: Record<ErrorCodeValue, number> = {
  INVALID_REQUEST: 400,
  UNAUTHENTICATED: 401,
  NOT_FOUND: 404,
  METHOD_NOT_ALLOWED: 405,
  PAYLOAD_TOO_LARGE: 413,
  UNSUPPORTED_MEDIA_TYPE: 415,
  RATE_LIMITED: 429,
  PROVIDER_RATE_LIMITED: 429,
  INTERNAL: 500,
  UPSTREAM_UNAVAILABLE: 502,
  TIMEOUT: 504,
  UPSTREAM_TIMEOUT: 504,
  SERVICE_UNAVAILABLE: 503,
};

export interface ErrorBody {
  error: {
    code: ErrorCodeValue;
    message: string;
    request_id: string;
    details?: unknown;
  };
}

export class AppError extends Error {
  readonly code: ErrorCodeValue;
  readonly status: number;
  readonly details?: unknown;
  /** Logged instead of the returned message when the cause is unsafe to echo. */
  readonly logMessage?: string;
  readonly expose = true;
  /** Seconds, set by rateLimited() and echoed as a Retry-After header. */
  retryAfter?: number;

  constructor(
    code: ErrorCodeValue,
    message: string,
    opts: { details?: unknown; cause?: unknown; logMessage?: string } = {}
  ) {
    super(message, opts.cause !== undefined ? { cause: opts.cause } : undefined);
    this.name = 'AppError';
    this.code = code;
    this.status = STATUS_BY_CODE[code];
    this.details = opts.details;
    this.logMessage = opts.logMessage;
  }

  toBody(requestId: string): ErrorBody {
    return {
      error: {
        code: this.code,
        message: this.message,
        request_id: requestId,
        ...(this.details === undefined ? {} : { details: this.details }),
      },
    };
  }
}

export const badRequest = (message: string, details?: unknown) =>
  new AppError(ErrorCode.INVALID_REQUEST, message, { details });

export const notFound = (message: string) => new AppError(ErrorCode.NOT_FOUND, message);

export const payloadTooLarge = (message: string, details?: unknown) =>
  new AppError(ErrorCode.PAYLOAD_TOO_LARGE, message, { details });

export const unsupportedMediaType = (message: string, details?: unknown) =>
  new AppError(ErrorCode.UNSUPPORTED_MEDIA_TYPE, message, { details });

export const unauthenticated = (message = 'Missing or invalid credentials') =>
  new AppError(ErrorCode.UNAUTHENTICATED, message);

export const upstreamTimeout = (upstream: string) =>
  new AppError(ErrorCode.UPSTREAM_TIMEOUT, `${upstream} did not respond in time`, {
    details: { upstream },
  });

export const upstreamUnavailable = (upstream: string, logMessage: string, cause?: unknown) =>
  new AppError(ErrorCode.UPSTREAM_UNAVAILABLE, `${upstream} is currently unavailable`, {
    details: { upstream },
    logMessage,
    cause,
  });

export const serviceUnavailable = (message: string, details?: unknown) =>
  new AppError(ErrorCode.SERVICE_UNAVAILABLE, message, { details });

export const rateLimited = (message: string, retryAfterSeconds: number) => {
  const err = new AppError(ErrorCode.RATE_LIMITED, message, {
    details: { retry_after_s: retryAfterSeconds },
  });
  err.retryAfter = retryAfterSeconds;
  return err;
};

export function statusForCode(code: ErrorCodeValue): number {
  return STATUS_BY_CODE[code];
}