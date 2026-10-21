import type { Instrumentation } from 'next';

export async function register() {
  if (!process.env.SENTRY_DSN) return;
  const Sentry = await import('@sentry/nextjs');
  const { sentryOptions } = await import('./lib/sentryPrivacy.mjs');
  const options = sentryOptions(process.env.SENTRY_DSN);
  if (options) Sentry.init(options);
}

export const onRequestError: Instrumentation.onRequestError = async (error, request, context) => {
  if (!process.env.SENTRY_DSN) return;
  const Sentry = await import('@sentry/nextjs');
  Sentry.withScope(scope => {
    const requestId = request.headers['x-request-id'];
    if (typeof requestId === 'string' && /^[\w-]{1,64}$/.test(requestId)) scope.setTag('request_id', requestId);
    Sentry.captureRequestError(error, request, context);
  });
};
