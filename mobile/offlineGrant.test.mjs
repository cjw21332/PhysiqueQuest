import assert from 'node:assert/strict';
import test from 'node:test';
import { validOfflineGrant } from './offlineGrant.mjs';

test('offline grant stays device and origin scoped without an expiry', () => {
  const issuedAt = 1_800_000_000_000;
  const grant = { id: 'abcdef012345abcdef012345', scope: 'frontend-and-api', issuedAt, expiresAt: 0 };
  assert.deepEqual(validOfflineGrant(grant, grant.scope, issuedAt), { ...grant, expiresAt: Number.MAX_SAFE_INTEGER });
  assert.equal(validOfflineGrant(grant, grant.scope, Number.MAX_SAFE_INTEGER - 1)?.id, grant.id);
  assert.equal(validOfflineGrant(grant, 'another-account-origin', issuedAt), null);
  assert.equal(validOfflineGrant({ ...grant, expiresAt: 1 }, grant.scope, issuedAt), null);
  assert.equal(validOfflineGrant({ ...grant, issuedAt: issuedAt + 1 }, grant.scope, issuedAt), null);
  assert.equal(validOfflineGrant({ ...grant, id: 'invalid' }, grant.scope, issuedAt), null);
  assert.equal(validOfflineGrant(null, grant.scope, issuedAt), null);
});

test('previously issued seven-day grants migrate to indefinite offline identity', () => {
  const now = 1_800_000_000_000;
  const lifetime = 7 * 24 * 60 * 60 * 1000;
  const legacy = { id: 'abcdef012345abcdef012345', scope: 'scope', issuedAt: now - lifetime * 2, expiresAt: now - lifetime };
  assert.equal(validOfflineGrant(legacy, 'scope', now)?.expiresAt, Number.MAX_SAFE_INTEGER);
});
