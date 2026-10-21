import * as Sentry from '@sentry/nestjs';
import { sentryOptions } from './sentry-privacy.js';

export function initializeSentry(dsn = process.env.SENTRY_DSN) {
  const options = sentryOptions(dsn);
  if (options) Sentry.init({ ...options, integrations: defaults => defaults.filter(integration => !['Console', 'ConsoleLogs', 'Http', 'LocalVariables'].includes(integration.name)) });
}

export function captureUnexpectedError(error: unknown, requestId?: string, capture: (error: unknown, context: { tags: { request_id?: string } }) => unknown = Sentry.captureException, dsn = process.env.SENTRY_DSN) {
  if (dsn) capture(error, { tags: { request_id: requestId } });
}
