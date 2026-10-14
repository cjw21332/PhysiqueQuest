import assert from 'node:assert/strict';
import test from 'node:test';
import { resolveCoachBaseUrl } from '../lib/coachBaseUrl.mjs';

test('Coach uses its independent LAN service and explicit deployment override', () => {
  assert.equal(resolveCoachBaseUrl(undefined, undefined, { protocol: 'http:', hostname: '192.168.1.10' }), 'http://192.168.1.10:4050/api');
  assert.equal(resolveCoachBaseUrl('https://coach.example.test', undefined), 'https://coach.example.test/api');
  assert.equal(resolveCoachBaseUrl(undefined, 'https://coach.example.test/api/'), 'https://coach.example.test/api');
  assert.equal(resolveCoachBaseUrl('file:///private'), null);
  assert.equal(resolveCoachBaseUrl('http://name:secret@host'), null);
});
