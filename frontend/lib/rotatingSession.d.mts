export interface SessionUser { offlineOnly?: boolean; sessionExpired?: boolean; id: string; name: string; email: string; token: string; sessionKey: number; expiresAt: number; emailVerified?: boolean; legacyEmailAccess?: boolean; }
export interface SessionResponse { access_token: string; expires_in: number; user: { id: string; name: string; email: string; emailVerified?: boolean; legacyEmailAccess?: boolean }; }
export type NativeRefresh = { status: 'ok'; session: SessionResponse } | { status: 'none' | 'unauthorized' | 'error' };
export function createSession(options?: { fetcher?: typeof fetch; storage?: () => Pick<Storage, 'getItem' | 'removeItem'> | undefined; headers?: () => Record<string, string>; nativeRefresh?: (base: string) => Promise<NativeRefresh | null> }): {
  current(base?: string): SessionUser | null;
  subscribe(listener: () => void): () => void;
  clear(): void;
  refresh(base: string): Promise<SessionUser | null>;
  restoreOffline(account:{id:string;expiresAt:number}, base:string):SessionUser | null;
  restore(base: string): Promise<SessionUser | null>;
  set(body: SessionResponse, base: string): SessionUser;
};
