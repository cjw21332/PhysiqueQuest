import { randomUUID } from 'node:crypto';
import { Injectable, type CallHandler, type ExecutionContext, type NestInterceptor } from '@nestjs/common';
import type { Response } from 'express';
import { Observable, finalize, tap } from 'rxjs';
import { PinoLogger } from './pino-logger.js';
import { INBOUND_ID_HEADER, normalizeInboundId, type ScanRequest } from './scan-request.js';

/**
 * Assigns a request id and emits exactly one access log line per request.
 *
 * Runs before authentication, so a rejected request is still correlatable.
 */
@Injectable()
export class RequestContextInterceptor implements NestInterceptor {
  constructor(private readonly logger: PinoLogger) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const http = context.switchToHttp();
    const req = http.getRequest<ScanRequest>();
    const res = http.getResponse<Response>();

    const inbound = normalizeInboundId(req.headers[INBOUND_ID_HEADER]);
    req.requestId = normalizeInboundId(req.requestId) ?? inbound ?? randomUUID();
    req.startedAt = Date.now();

    // Safe by construction: normalizeInboundId only passes the SAFE_REQUEST_ID shape.
    res.setHeader(INBOUND_ID_HEADER, req.requestId);

    return next.handle().pipe(
      tap({
        // Only the success path is logged here. On failure the exception filter
        // owns the record, because it is the only layer that knows the final
        // status: at the time this observable settles the response is still the
        // default 200/201, so logging it would report every failed scan as a
        // success and leave error rates reading as zero.
        next: () => {
          const status = res.statusCode;
          this.logger.event(status >= 500 ? 'error' : status >= 400 ? 'warn' : 'info', {
            event: 'http_request',
            request_id: req.requestId,
            method: req.method,
            // req.path only: the query string can carry search terms.
            path: req.path,
            status,
            duration_ms: Date.now() - (req.startedAt ?? Date.now()),
          }, 'request completed');
        },
      }),
      // Still fires when the handler throws, and records how long the failed
      // attempt was allowed to run before the deadline or an upstream gave up.
      finalize(() => {
        if (req.startedAt !== undefined) req.durationMs = Date.now() - req.startedAt;
      })
    );
  }
}
