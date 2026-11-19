export class ApiNetworkError extends Error {
  constructor() {
    super('We couldn’t connect. Check your internet connection and try again.');
    this.name = 'ApiNetworkError';
  }
}

/** Keep useful validation guidance while avoiding implementation details in the app. */
export function friendlyRequestMessage(status, message) {
  if (status >= 500) return 'Something went wrong on our end. Please try again in a moment.';
  if (status === 429) return 'Too many attempts. Please wait a moment and try again.';
  const text = Array.isArray(message) ? message.join(', ') : typeof message === 'string' ? message.trim() : '';
  if (!text || /\b(api|backend|database|server|endpoint|stack trace|exception|http|timeout|provider|internal error|request failed|mongodb|jwt|token)\b/i.test(text)) {
    return 'Something went wrong. Please try again.';
  }
  return text;
}

/** @param {unknown} error @returns {unknown} */
export function normalizeTransportError(error) {
  return error instanceof TypeError ? new ApiNetworkError() : error;
}
