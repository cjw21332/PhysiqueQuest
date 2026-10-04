import assert from 'node:assert/strict';
import test from 'node:test';
import { normalizeTransportError, ApiNetworkError } from '../lib/apiErrors.mjs';

test('labels a rejected fetch as backend connectivity failure', () => {
  const result = normalizeTransportError(new TypeError('fetch failed'));
  assert.ok(result instanceof ApiNetworkError);
  assert.equal(result.name, 'ApiNetworkError');
  assert.match(result.message, /reach the PhysiqueQuest API/);
});

test('preserves server errors with status codes and caller aborts', () => {
  const serverError = Object.assign(new Error('validation failed'), { statusCode: 400 });
  const abortError = new DOMException('aborted', 'AbortError');
  assert.equal(normalizeTransportError(serverError), serverError);
  assert.equal(normalizeTransportError(abortError), abortError);
});
