import assert from 'node:assert/strict';
import test from 'node:test';
import { OFFLINE_GRANT_LIFETIME_MS, validOfflineGrant } from './offlineGrant.mjs';

test('offline grant is scoped to the origin and expires exactly seven days after issue', () => {
  const issuedAt = 1_800_000_000_000;
  const grant = { id: 'abcdef012345abcdef012345', scope: 'frontend-and-api', issuedAt, expiresAt: issuedAt + OFFLINE_GRANT_LIFETIME_MS };
  assert.deepEqual(validOfflineGrant(grant, grant.scope, issuedAt), grant);
  assert.equal(validOfflineGrant(grant, grant.scope, grant.expiresAt), null);
  assert.equal(validOfflineGrant(grant, 'another-account-origin', issuedAt), null);
  assert.equal(validOfflineGrant({ ...grant, expiresAt: grant.expiresAt + 1 }, grant.scope, issuedAt), null);
  assert.equal(validOfflineGrant({ ...grant, issuedAt: issuedAt + 1 }, grant.scope, issuedAt), null);
  assert.equal(validOfflineGrant({ ...grant, id: 'invalid' }, grant.scope, issuedAt), null);
  assert.equal(validOfflineGrant(null, grant.scope, issuedAt), null);
});

test('previously issued grants retain their original expiry', () => {
  const now = 1_800_000_000_000;
  const legacy = { id: 'abcdef012345abcdef012345', scope: 'scope', expiresAt: now + 5000 };
  assert.equal(validOfflineGrant(legacy, 'scope', now)?.expiresAt, legacy.expiresAt);
});
