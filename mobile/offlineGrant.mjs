// The offline account identity remains on this device until the user logs out.
// It grants no server access; the account must reauthenticate for online work.
export const OFFLINE_GRANT_LIFETIME_MS = 0;

/** Validate the native-stored grant and its origin binding without exposing credentials. */
export function validOfflineGrant(value, scope, now = Date.now()) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const { id, expiresAt } = value;
  const issuedAt = value.issuedAt ?? (typeof expiresAt === 'number' ? expiresAt - 7 * 24 * 60 * 60 * 1000 : NaN);
  const indefinite = expiresAt === 0;
  const legacySevenDay = Number.isSafeInteger(expiresAt) && expiresAt - issuedAt === 7 * 24 * 60 * 60 * 1000;
  if (typeof id !== 'string' || !/^[a-f0-9]{24}$/i.test(id) ||
      value.scope !== scope || !Number.isSafeInteger(issuedAt) || !Number.isSafeInteger(expiresAt) ||
      issuedAt > now || (!indefinite && !legacySevenDay)) return null;
  return { id, scope, issuedAt, expiresAt: Number.MAX_SAFE_INTEGER };
}
