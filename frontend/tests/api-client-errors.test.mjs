import assert from 'node:assert/strict';
import test from 'node:test';
import { normalizeTransportError, ApiNetworkError, friendlyRequestMessage } from '../lib/apiErrors.mjs';

test('labels a rejected fetch as backend connectivity failure', () => {
  const result = normalizeTransportError(new TypeError('fetch failed'));
  assert.ok(result instanceof ApiNetworkError);
  assert.equal(result.name, 'ApiNetworkError');
  assert.equal(result.message, 'We couldn’t connect. Check your internet connection and try again.');
});

test('keeps useful guidance while hiding technical details', () => {
  assert.equal(friendlyRequestMessage(400, 'Enter a valid email address.'), 'Enter a valid email address.');
  assert.equal(friendlyRequestMessage(401, 'Incorrect email or password.'), 'Incorrect email or password.');
  assert.equal(friendlyRequestMessage(500, 'Internal server error'), 'Something went wrong on our end. Please try again in a moment.');
  assert.equal(friendlyRequestMessage(404, 'Request failed (404)'), 'Something went wrong. Please try again.');
});

test('preserves server errors with status codes and caller aborts', () => {
  const serverError = Object.assign(new Error('validation failed'), { statusCode: 400 });
  const abortError = new DOMException('aborted', 'AbortError');
  assert.equal(normalizeTransportError(serverError), serverError);
  assert.equal(normalizeTransportError(abortError), abortError);
});
