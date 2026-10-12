export const COUNTDOWN_SECONDS = 30;
export const HOLD_TO_STOP_MS = 3000;
export const LOCATION_TIMEOUT_MS = 5000;

const ERROR_TEXT = {
  PROVIDER_NOT_CONFIGURED: 'alert provider is not configured.',
  CONTACT_NOT_CONFIGURED: 'no emergency contact is saved.',
  DELIVERY_NOT_CONFIRMED: 'the provider did not confirm delivery.',
};

/** Status text for an alert. "Delivered" appears only when the backend says `delivered`. */
export function alertStatusText(status, errorCode) {
  if (status === 'delivered') return 'Delivered';
  if (status === 'pending') return 'Sending...';
  if (status === 'cancelled') return 'Not sent';
  if (status === 'failed') {
    const reason = ERROR_TEXT[errorCode];
    return reason ? `Not delivered: ${reason}` : 'Not delivered.';
  }
  return 'Status unknown';
}

/** Admin log badge for an alert row. */
export function alertLogBadge(event) {
  if (event.eventType === 'cancelled') return 'False alarm';
  if (event.eventType === 'inactivity' && event.resolvedAt) return 'Resolved';
  if (event.eventType === 'inactivity') return 'Open';
  return 'Manual';
}
