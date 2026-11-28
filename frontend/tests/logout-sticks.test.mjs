import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const source = path => readFile(new URL(`../${path}`, import.meta.url), 'utf8');

// Regression: after Me › Log out, reopening the phone app signed the user back in by itself.
test('an explicit logout blocks automatic session restore until the next sign-in', async () => {
  const auth = await source('lib/auth.ts');
  const boundary = await source('components/SessionBoundary.tsx');
  // Logout marks the device signed out even when the server call fails.
  assert.match(auth, /finally \{\s*clearAuthSession\(\);\s*markSignedOut\(true\);/);
  // Every explicit sign-in (email, register, Google) goes through announceSuccessfulAuth, which clears it.
  assert.match(auth, /function announceSuccessfulAuth\(\)[^}]*markSignedOut\(false\)/);
  assert.equal(auth.match(/session\.set\(response, getApiBaseUrl\(\)\);\s*announceSuccessfulAuth\(\);/g)?.length, 4);
  // The startup restore checks the marker before any offline or server restore.
  const gate = boundary.indexOf('if (signedOutByUser())');
  assert.ok(gate > 0, 'SessionBoundary checks the signed-out marker');
  assert.ok(gate < boundary.indexOf("nativeOfflineAccount('restore-offline-account')"));
  assert.ok(gate < boundary.indexOf('session.restore(base)'));
});

test('the app shell never links a device session after a logout arrived', async () => {
  const shell = await source('../mobile/App.tsx');
  assert.match(shell, /forget-offline-account'\) \{ forgetCount\.current\+\+;/);
  assert.match(shell, /grant && forgetCount\.current === forgetsAtStart\) void linkDeviceSession/);
});
