import type { ErrorEvent, Event, EventHint } from '@sentry/nextjs';
export function scrubSentryEvent(event: Event, hint?: EventHint): ErrorEvent;
export function sentryOptions(dsn: string | undefined): { dsn: string; sendDefaultPii: false; tracesSampleRate: number; enableLogs: false; beforeSend: typeof scrubSentryEvent; beforeBreadcrumb: () => null } | undefined;
