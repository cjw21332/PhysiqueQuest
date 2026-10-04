import { Catch, HttpException, type ArgumentsHost, type ExceptionFilter } from '@nestjs/common';
import type { NextFunction, Request, Response } from 'express';
import { ZodError } from 'zod';
import { AppError, ErrorCode, statusForCode } from './errors.js';
import { PinoLogger } from './pino-logger.js';
import { redact, safeString } from './redact.js';
import type { ScanRequest } from './scan-request.js';

interface BodyParserError extends Error {
  type?: string;
  status?: number;
  statusCode?: number;
  expose?: boolean;
}

const ERROR_CODES = Object.keys(ErrorCode) as Array<keyof typeof ErrorCode>;

/** Nest exceptions carry their own status; wrap rather than discard. */
function fromHttpException(err: HttpException): AppError {
  const status = err.getStatus();
  // 504 is claimed by both TIMEOUT and UPSTREAM_TIMEOUT; prefer the specific one.
  const code =
    ERROR_CODES.find((key) => key !== 'UPSTREAM_TIMEOUT' && statusForCode(key) === status) ??
    ERROR_CODES.find((key) => statusForCode(key) === status);

  const response = err.getResponse();
  let message = err.message;
  let details: unknown;

  if (typeof response === 'object' && response !== null) {
    const raw = (response as { message?: unknown }).message;
    if (typeof raw === 'string') {
      message = raw;
    } else if (Array.isArray(raw)) {
      // class-validator reports a string array; the client joins these.
      message = raw.join(', ');
      details = { issues: raw };
    }
  }

  return new AppError(code ?? ErrorCode.INTERNAL, message, {
    details,
    logMessage: status >= 500 ? err.stack ?? err.message : undefined,
    cause: err,
  });
}

/**
 * Normalises anything thrown on the way into a scan handler into a client-safe
 * AppError.
 *
 * Validation failures are folded into INVALID_REQUEST so the caller sees one
 * error shape regardless of whether Zod, class-validator or the body parser
 * produced it.
 */
export function toAppError(err: unknown): AppError {
  if (err instanceof AppError) return err;

  if (err instanceof ZodError) {
    return new AppError(ErrorCode.INVALID_REQUEST, 'Request failed validation', {
      details: {
        issues: err.issues.map((i) => ({
          path: i.path.join('.') || '(root)',
          code: i.code,
          message: i.message,
        })),
      },
    });
  }

  if (err instanceof HttpException) return fromHttpException(err);

  // Errors raised by the JSON body parser before any route handler runs.
  const bp = err as BodyParserError | undefined;
  if (bp?.type === 'entity.too.large') {
    return new AppError(ErrorCode.PAYLOAD_TOO_LARGE, 'Request body is too large');
  }
  if (bp?.type === 'entity.parse.failed' || (bp instanceof SyntaxError && 'body' in bp)) {
    return new AppError(ErrorCode.INVALID_REQUEST, 'Request body is not valid JSON');
  }
  if (bp?.type === 'encoding.unsupported' || bp?.type === 'charset.unsupported') {
    return new AppError(ErrorCode.UNSUPPORTED_MEDIA_TYPE, 'Unsupported content encoding or charset');
  }

  return new AppError(ErrorCode.INTERNAL, 'Internal server error', {
    logMessage: `unhandled error: ${err instanceof Error ? (err.stack ?? err.message) : String(err)}`,
    cause: err,
  });
}

/**
 * Logs the failure and writes the scanner error envelope.
 *
 * Shared by {@link AppExceptionFilter} and {@link scannerBodyErrorHandler} so a
 * malformed request body is reported identically no matter which layer noticed
 * it.
 */
export function writeAppError(
  logger: PinoLogger,
  req: ScanRequest,
  res: Response,
  exception: unknown
): void {
  const appErr = toAppError(exception);
  const requestId = req.requestId ?? 'unknown';

  const logPayload = {
    event: 'request_failed',
    request_id: requestId,
    user_id: req.user?.userId,
    code: appErr.code,
    status: appErr.status,
    method: req.method,
    // req.path only: the query string can carry search terms.
    path: req.path,
    ...(req.durationMs === undefined ? {} : { duration_ms: req.durationMs }),
    ...(appErr.details === undefined ? {} : { details: redact(appErr.details) }),
  };

  if (appErr.status >= 500) {
    logger.event(
      'error',
      {
        ...logPayload,
        reason: appErr.logMessage ?? appErr.message,
        err: (appErr.cause as Error) ?? appErr,
      },
      'request failed'
    );
  } else {
    logger.event('warn', logPayload, safeString(appErr.message));
  }

  if (res.headersSent) {
    // Too late to change the status line; hand off so the socket is closed.
    res.end();
    return;
  }

  if (typeof appErr.retryAfter === 'number') {
    res.setHeader('Retry-After', String(appErr.retryAfter));
  }

  res.status(appErr.status).json(appErr.toBody(requestId));
}

/**
 * Error `type` tags set by body-parser. Only these are claimed by
 * {@link scannerBodyErrorHandler}; anything else is forwarded untouched so Nest's
 * own filter stack still handles errors raised inside a route handler.
 */
const BODY_PARSER_ERROR_TYPES = new Set([
  'entity.parse.failed',
  'entity.too.large',
  'entity.verify.failed',
  'encoding.unsupported',
  'charset.unsupported',
  'request.aborted',
  'request.size.invalid',
  'parameters.too.many',
]);

/**
 * Express error middleware for the scanner routes.
 *
 * The JSON body parser rejects unparseable, oversized and mis-encoded bodies
 * before Nest has matched a route, so a controller-scoped filter never sees
 * them and the caller would otherwise receive Express's bare error. Register it
 * after `useBodyParser`, so it is downstream of the parser that raises these.
 *
 * Errors that did not come from the parser are passed straight on, keeping the
 * controller's own filter responsible for everything raised inside a handler.
 * Requests outside `scannerPaths` are likewise untouched: rewriting every
 * route's error body would strip the top-level `message` the web client reads.
 */
export function scannerBodyErrorHandler(
  logger: PinoLogger,
  scannerPaths: readonly string[]
): (err: unknown, req: Request, res: Response, next: NextFunction) => void {
  return (err, req, res, next) => {
    const type = (err as BodyParserError | undefined)?.type;
    const isScannerRoute = scannerPaths.some((p) => req.path === p || req.path.startsWith(`${p}/`));
    if (!isScannerRoute || !type || !BODY_PARSER_ERROR_TYPES.has(type)) {
      next(err);
      return;
    }
    writeAppError(logger, req as ScanRequest, res, err);
  };
}

/**
 * Terminal error handler for the food scan endpoints.
 *
 * Bound per-controller rather than registered globally: the web client reads
 * `message` and `error` off Nest's default exception body, so applying this
 * envelope everywhere would blank out the message on every existing route.
 */
@Catch()
export class AppExceptionFilter implements ExceptionFilter {
  constructor(private readonly logger: PinoLogger) {}

  catch(exception: unknown, host: ArgumentsHost): void {
    const http = host.switchToHttp();
    writeAppError(this.logger, http.getRequest<ScanRequest>(), http.getResponse<Response>(), exception);
  }
}