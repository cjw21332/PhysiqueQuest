export const OFFLINE_GRANT_LIFETIME_MS = 7 * 24 * 60 * 60 * 1000;

/** Validate the native-stored grant and its origin binding without exposing credentials. */
export function validOfflineGrant(value, scope, now = Date.now()) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const { id, expiresAt } = value;
  const issuedAt = value.issuedAt ?? (typeof expiresAt === 'number' ? expiresAt - OFFLINE_GRANT_LIFETIME_MS : NaN);
  if (typeof id !== 'string' || !/^[a-f0-9]{24}$/i.test(id) ||
      value.scope !== scope || !Number.isSafeInteger(issuedAt) || !Number.isSafeInteger(expiresAt) ||
      issuedAt > now || expiresAt <= now || expiresAt - issuedAt !== OFFLINE_GRANT_LIFETIME_MS) return null;
  return { id, scope, issuedAt, expiresAt };
}
