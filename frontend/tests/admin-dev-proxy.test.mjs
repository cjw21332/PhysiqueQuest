import test from 'node:test';
import assert from 'node:assert/strict';
import {allowedBackendPath, allowedLocalRequest, isolatedCookies, upstreamHeaders} from '../scripts/admin-dev-proxy.mjs';

test('the gateway accepts only expected loopback and same-origin requests', () => {
  assert.equal(allowedLocalRequest({host:'127.0.0.1:3100',origin:'http://127.0.0.1:3100',method:'POST'},3100),true);
  assert.equal(allowedLocalRequest({host:'127.0.0.1:3100',origin:'https://attacker.test',method:'POST'},3100),false);
  assert.equal(allowedLocalRequest({host:'attacker.test:3100',method:'GET'},3100),false);
  assert.equal(allowedLocalRequest({host:'127.0.0.1:3100',method:'GET',fetchSite:'cross-site'},3100),false);
  assert.equal(allowedLocalRequest({host:'127.0.0.1:3100',method:'POST'},3100),false);
});
test('the gateway forwards only dashboard routes with expected methods', () => {
  assert.equal(allowedBackendPath('POST','/api/auth/session/admin-login'),true);
  assert.equal(allowedBackendPath('GET','/api/admin/dashboard/users'),true);
  assert.equal(allowedBackendPath('GET','/api/auth/session/admin-login'),false);
  assert.equal(allowedBackendPath('POST','/api/workouts'),false);
  assert.equal(allowedBackendPath('GET','/api/admin/../profile'),false);
});
test('refresh cookies are isolated from the rest of the local application', () => {
  const token = `${'a'.repeat(64)}.${'b'.repeat(64)}`;
  const headers = upstreamHeaders({cookie:`other=secret; pq_refresh=old; pq_admin_refresh=${token}`,authorization:'Bearer access','x-forwarded-for':'attacker'},'https://physiquequest-web.onrender.com');
  assert.equal(headers.cookie,`pq_refresh=${token}`);
  assert.equal(headers['x-forwarded-for'],undefined);
  assert.equal(headers.authorization,'Bearer access');
  assert.deepEqual(isolatedCookies(['pq_refresh=abc; Domain=example.test; Path=/api; HttpOnly; Secure; SameSite=Lax','other=private']),['pq_admin_refresh=abc; Path=/api; HttpOnly; Secure; SameSite=Lax']);
});
