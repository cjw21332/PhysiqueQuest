import assert from 'node:assert/strict';
import test from 'node:test';
import { COUNTDOWN_SECONDS, HOLD_TO_STOP_MS, alertLogBadge, alertStatusText } from '../lib/inactivityConstants.mjs';

test('countdown and hold-to-stop constants match the spec', () => {
  assert.equal(COUNTDOWN_SECONDS, 30);
  assert.equal(HOLD_TO_STOP_MS, 3000);
});

test('"Delivered" appears only for backend delivered status', () => {
  assert.equal(alertStatusText('delivered'), 'Delivered');
  assert.notEqual(alertStatusText('failed', 'PROVIDER_NOT_CONFIGURED'), 'Delivered');
  assert.notEqual(alertStatusText('pending'), 'Delivered');
});

test('failed status shows the reason from the error code', () => {
  assert.equal(alertStatusText('failed', 'PROVIDER_NOT_CONFIGURED'), 'Not delivered: alert provider is not configured.');
  assert.equal(alertStatusText('failed', 'CONTACT_NOT_CONFIGURED'), 'Not delivered: no emergency contact is saved.');
  assert.equal(alertStatusText('failed'), 'Not delivered.');
});

test('pending shows sending, cancelled shows not sent', () => {
  assert.equal(alertStatusText('pending'), 'Sending...');
  assert.equal(alertStatusText('cancelled'), 'Not sent');
});

test('admin badges: open, resolved, false alarm', () => {
  assert.equal(alertLogBadge({ eventType: 'inactivity', resolvedAt: null }), 'Open');
  assert.equal(alertLogBadge({ eventType: 'inactivity', resolvedAt: '2026-11-18T12:00:00Z' }), 'Resolved');
  assert.equal(alertLogBadge({ eventType: 'cancelled', resolvedAt: null }), 'False alarm');
});
