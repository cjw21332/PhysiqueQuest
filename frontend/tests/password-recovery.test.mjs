import assert from 'node:assert/strict';
import test from 'node:test';
import { readFile } from 'node:fs/promises';
const source = path => readFile(new URL(`../${path}`, import.meta.url), 'utf8');
test('password recovery uses server-issued tokens and shows provider setup state', async () => {
  const screen = await source('sections/Forgot Password/ForgotPasswordFlow.tsx');
  const api = await source('lib/api.ts');
  assert.match(screen, /requestPasswordReset/);
  assert.match(screen, /confirmPasswordReset/);
  assert.match(screen, /delivery.*unavailable|email delivery is not configured/i);
  assert.doesNotMatch(screen, /Simulate OTP|Show success modal/);
  assert.match(api, /password-reset/);
});
