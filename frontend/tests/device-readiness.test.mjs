import assert from 'node:assert/strict';
import test from 'node:test';
import { deviceOsStatus } from '../lib/deviceReadiness.mjs';

test('Android below 12 or an unavailable OS version never passes Android 12 readiness', () => {
  for (const version of ['10', '11.0', null, undefined, 'unknown']) assert.equal(deviceOsStatus('android', version).ready, false);
  for (const version of ['12', '13.0', '14']) assert.deepEqual(deviceOsStatus('android', version), { title: 'Android 12 or higher', ready: true });
});

test('iOS and browsers do not claim Android compatibility', () => {
  assert.deepEqual(deviceOsStatus('ios', '18'), { title: 'iOS device', ready: true });
  assert.deepEqual(deviceOsStatus('browser', null), { title: 'Device compatibility', ready: false });
});
