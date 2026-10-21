import { Injectable, type LoggerService } from '@nestjs/common';
import pino, { type DestinationStream, type Logger, type LoggerOptions } from 'pino';
import { FoodScanConfigService } from './foodscan-config.js';

/**
 * Structured JSON logging to stdout. Container and orchestrator log collectors
 * ingest stdout, so no file handling lives here.
 *
 * The options object is exported so tests can build a logger with the exact
 * production redaction rules against an in-memory stream.
 */
export function buildLoggerOptions(level: string): LoggerOptions {
  return {
    level,
    base: { service: 'physiquequest-backend' },
    timestamp: pino.stdTimeFunctions.isoTime,
    messageKey: 'msg',
    formatters: {
      level: (label) => ({ level: label }),
    },
    // Defence in depth: redact at the serializer too, so a future code path that
    // logs req.headers directly still cannot leak a token or a photo.
    redact: {
      paths: [
        'req.headers.authorization',
        'req.headers.cookie',
        'req.headers["x-internal-api-key"]',
        'headers.authorization',
        'headers.cookie',
        'headers["x-internal-api-key"]',
        'token',
        'password',
        'passwordHash',
        'access_token',
        'refresh_token',
        'resetToken',
        'email',
        '*.password',
        '*.passwordHash',
        '*.access_token',
        '*.refresh_token',
        '*.resetToken',
        '*.email',
        'body',
        '*.body',
        'req.body',
        'apiKey',
        'api_key',
        'image',
        '*.image',
        ...['conditions', 'healthNotes', 'contactName', 'contactPhone', 'contactRelationship'].flatMap(field => [field, `*.${field}`]),
      ],
      censor: '[redacted]',
    },
    serializers: {
      err: pino.stdSerializers.err,
    },
  };
}

/**
 * Bridges Nest's logging interface onto pino.
 *
 * Nest calls `log(message, context)` with a bare string in a large number of
 * places, so the message is always coerced before it reaches pino. Structured
 * payloads are logged with a dedicated method rather than by sniffing the
 * argument types, which keeps the call sites readable.
 */
@Injectable()
export class PinoLogger implements LoggerService {
  private logger?: Logger;

  constructor(private readonly config: FoodScanConfigService) {}

  private get instance(): Logger {
    this.logger ??= createLogger(undefined, this.config.logLevel);
    return this.logger;
  }

  log(message: unknown, ...optional: unknown[]): void {
    this.instance.info(this.coerce(message, optional));
  }

  error(message: unknown, ...optional: unknown[]): void {
    this.instance.error(this.coerce(message, optional));
  }

  warn(message: unknown, ...optional: unknown[]): void {
    this.instance.warn(this.coerce(message, optional));
  }

  debug(message: unknown, ...optional: unknown[]): void {
    this.instance.debug(this.coerce(message, optional));
  }

  verbose(message: unknown, ...optional: unknown[]): void {
    this.instance.debug(this.coerce(message, optional));
  }

  fatal(message: unknown, ...optional: unknown[]): void {
    this.instance.fatal(this.coerce(message, optional));
  }

  /** Structured entry with an explicit event name, used by the scan pipeline. */
  event(level: 'info' | 'warn' | 'error' | 'debug', payload: Record<string, unknown>, message: string): void {
    this.instance[level](payload, message);
  }

  private coerce(message: unknown, optional: unknown[]): Record<string, unknown> {
    const context = optional.length > 0 ? { context: optional[0] } : {};
    if (typeof message === 'string') return { ...context, msg: message };
    if (message instanceof Error) return { ...context, err: message };
    if (message && typeof message === 'object') return { ...context, ...(message as Record<string, unknown>) };
    return { ...context, msg: String(message) };
  }
}

export function createLogger(destination?: DestinationStream, level = 'info'): Logger {
  return destination ? pino(buildLoggerOptions(level), destination) : pino(buildLoggerOptions(level));
}
