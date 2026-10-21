import { Catch, HttpException, type ArgumentsHost, type ExceptionFilter, type LoggerService } from '@nestjs/common';
import type { Request, Response } from 'express';
import { captureUnexpectedError } from './sentry.js';

@Catch()
export class SafeExceptionFilter implements ExceptionFilter {
  constructor(private readonly logger: LoggerService) {}
  catch(error: unknown, host: ArgumentsHost) {
    const http = host.switchToHttp();
    const req = http.getRequest<Request & { requestId?: string }>();
    const res = http.getResponse<Response>();
    if (res.headersSent) { res.end(); return; }
    const parserType = (error as { type?: string })?.type;
    const parserStatus = parserType === 'entity.too.large' ? 413 : parserType === 'entity.parse.failed' ? 400 : undefined;
    const status = error instanceof HttpException ? error.getStatus() : parserStatus ?? 500;
    const body = error instanceof HttpException ? error.getResponse() : null;
    const code = status >= 500 ? 'INTERNAL' : `HTTP_${status}`;
    const response = status >= 500 ? { message: 'Internal server error' } : typeof body === 'object' && body ? body : { message: body ?? (parserStatus === 413 ? 'Request body is too large' : parserStatus === 400 ? 'Request body is not valid JSON' : 'Request failed') };
    if (status >= 500) {
      captureUnexpectedError(error, req.requestId);
      this.logger.error({ event: 'request_failed', request_id: req.requestId, status, errorType: error instanceof Error ? error.name : 'Unknown' });
    }
    res.status(status).json({ statusCode: status, code, ...response, request_id: req.requestId ?? 'unknown' });
  }
}
