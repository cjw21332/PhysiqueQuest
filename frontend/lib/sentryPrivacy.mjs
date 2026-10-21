// Allowlist instead of recursive redaction: private values can also appear in error messages.
export function scrubSentryEvent(event, hint) {
  if (hint) hint.attachments = [];
  const requestId = event.tags?.request_id;
  return {
    type: undefined,
    event_id: event.event_id,
    timestamp: event.timestamp,
    platform: event.platform,
    level: event.level,
    tags: typeof requestId === 'string' && /^[\w-]{1,64}$/.test(requestId) ? { request_id: requestId } : {},
    exception: event.exception ? { values: event.exception.values?.map(exception => ({
      type: /^(?:Error|TypeError|RangeError|ReferenceError|SyntaxError|URIError|EvalError)$/.test(exception.type) ? exception.type : 'Error',
      value: 'Unexpected application error',
      stacktrace: exception.stacktrace ? { frames: exception.stacktrace.frames?.map(frame => ({
        filename: frame.filename?.split(/[?#]/)[0].split(/[\\/]/).pop()?.replace(/[^\w.-]/g, '_'),
        lineno: frame.lineno,
        colno: frame.colno,
        in_app: frame.in_app,
      })) } : undefined,
    })) } : undefined,
  };
}

export function sentryOptions(dsn) {
  return dsn ? { dsn, sendDefaultPii: false, tracesSampleRate: 0, enableLogs: false, beforeSend: scrubSentryEvent, beforeBreadcrumb: () => null } : undefined;
}
