import { test } from 'node:test';
import assert from 'node:assert/strict';
import { scrubSentryEvent, sentryOptions } from '../lib/sentryPrivacy.mjs';

test('Sentry remains disabled without a public DSN', () => assert.equal(sentryOptions(undefined), undefined));
test('Sentry removes private values and retains only correlation tag and safe error structure', () => {
  const privateValue = 'secret@example.invalid';
  const event = scrubSentryEvent({ message: privateValue, user: { email: privateValue }, request: { cookies: privateValue, headers: { authorization: privateValue }, data: { conditions: privateValue } }, extra: { healthNotes: privateValue }, contexts: { profile: privateValue }, breadcrumbs: [{ message: privateValue }], tags: { request_id: 'request-1', user_id: privateValue }, exception: { values: [{ type: 'TypeError', value: privateValue, stacktrace: { frames: [{ filename: '/private/person/app.js?token=secret', lineno: 12, vars: { password: privateValue } }] } }] } });
  assert.equal(JSON.stringify(event).includes(privateValue), false);
  assert.deepEqual(event.tags, { request_id: 'request-1' });
  assert.equal(event.exception.values[0].value, 'Unexpected application error');
  assert.equal(event.exception.values[0].stacktrace.frames[0].filename, 'app.js');
  assert.deepEqual(scrubSentryEvent({ tags: { request_id: privateValue } }).tags, {});
});
