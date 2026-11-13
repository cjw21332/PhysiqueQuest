import assert from 'node:assert/strict';
import test from 'node:test';
import { parseDataChange, announceDataChange, DATA_CHANGE_EVENT, DATA_CHANGE_KEY } from '../lib/dataChanges.mjs';

test('accepts only known resources belonging to the active account and API', () => {
  const message = JSON.stringify({ scope: 'https://example.test/api:user-a', resources: ['nutrition', 'activity', 'nutrition', 'unexpected'] });
  assert.deepEqual(parseDataChange(message, 'https://example.test/api:user-a'), ['nutrition', 'activity']);
  assert.equal(parseDataChange(message, 'https://example.test/api:user-b'), null);
  assert.equal(parseDataChange(message, 'https://other.test/api:user-a'), null);
  assert.equal(parseDataChange('{broken', 'https://example.test/api:user-a'), null);
});

test('announces only allowed resources locally and to other tabs', () => {
  const previousWindow = globalThis.window, previousCustomEvent = globalThis.CustomEvent;
  const events = [], writes = [];
  globalThis.CustomEvent = class { constructor(type, options) { this.type = type; this.detail = options.detail; } };
  globalThis.window = { dispatchEvent: event => events.push(event), localStorage: { setItem: (key, value) => writes.push([key, value]) } };
  try {
    announceDataChange('api:user-a', ['settings', 'coach', 'settings', 'unknown']);
    assert.equal(events[0].type, DATA_CHANGE_EVENT);
    assert.deepEqual(events[0].detail.resources, ['settings', 'coach']);
    assert.equal(writes[0][0], DATA_CHANGE_KEY);
    assert.deepEqual(parseDataChange(writes[0][1], 'api:user-a'), ['settings', 'coach']);
  } finally { globalThis.window = previousWindow; globalThis.CustomEvent = previousCustomEvent; }
});
