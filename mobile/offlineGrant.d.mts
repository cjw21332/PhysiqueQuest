export const OFFLINE_GRANT_LIFETIME_MS: number;
export function validOfflineGrant(value: unknown, scope: string, now?: number): { id: string; scope: string; issuedAt: number; expiresAt: number } | null;
