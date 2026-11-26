// nativeRefresh: in the app shell, refreshes through the device's secure-store session.
// It resolves { status: 'ok', session } | { status: 'unauthorized' | 'error' } or null/'none' to use the cookie.
export function createSession({ fetcher = (...args) => fetch(...args), storage = () => undefined, headers = () => ({}), nativeRefresh = null } = {}) {
  let user = null, base = null, generation = 0, pending = null, restoring = null, legacyToken = null, legacyBase = null;
  const listeners = new Set();
  const notify = () => { for (const listener of listeners) listener(); };
  const current = (url) => (!url || url === base) ? user : null;
  const clear = () => { user = null; base = null; legacyToken = null; legacyBase = null; generation++; notify(); };
  const accept = (body, url) => {
    if (body.refresh_token || typeof body.access_token !== 'string' || !body.user?.id || typeof body.expires_in !== 'number') throw Error('Invalid session response');
    base = url;
    user = { ...body.user, token: body.access_token, sessionKey: generation, expiresAt: Date.now() + body.expires_in * 1000 };
    notify();
    return user;
  };
  const request = async (url, legacy) => {
    const revision = generation;
    const rejected = () => {
      if (user?.offlineOnly) {
        user = { ...user, sessionExpired: true };
        notify();
      } else if (user?.id && user.token) {
        user = { ...user, token: '', offlineOnly: true, sessionExpired: true, expiresAt: Number.MAX_SAFE_INTEGER, sessionKey: ++generation };
        notify();
      } else clear();
      return null;
    };
    const operation = async () => {
      const device = legacy || !nativeRefresh ? null : await nativeRefresh(url);
      if (revision !== generation) return null;
      if (device?.status === 'ok') return accept(device.session, url);
      if (device?.status === 'unauthorized') return rejected();
      if (device?.status === 'error') throw Error('Could not restore your session. Check your connection and retry.');
      const response = await fetcher(`${url}/auth/session/${legacy ? 'migrate' : 'refresh'}`, {
        method: 'POST', credentials: 'include', headers: { 'Content-Type': 'application/json', ...headers(), ...(legacy ? { Authorization: `Bearer ${legacy}` } : {}) }, body: '{}', signal: AbortSignal.timeout(15_000),
      });
      if (revision !== generation) return null;
      if (response.status === 401) return rejected();
      if (!response.ok) throw Error('Could not restore your session. Check your connection and retry.');
      const body = await response.json();
      if (revision !== generation) return null;
      return accept(body, url);
    };
    return typeof navigator !== 'undefined' && navigator.locks ? navigator.locks.request('physiquequest-refresh', operation) : operation();
  };
  const refresh = (url) => {
    if (pending) return pending;
    pending = request(url).finally(() => { pending = null; });
    return pending;
  };
  const restoreOnce = async (url) => {
    if (legacyBase && legacyBase !== url) { legacyToken = null; legacyBase = null; }
    if (!legacyToken) {
      try {
        const value = JSON.parse(storage()?.getItem('physiquequest-auth') ?? 'null')?.token;
        if (typeof value === 'string' && value.length < 8192) { legacyToken = value; legacyBase = url; }
      } catch { /* Malformed old storage is discarded. */ }
    }
    try { storage()?.removeItem('physiquequest-auth'); } catch { /* Storage may be disabled. */ }
    if (legacyToken) {
      const migrated = await request(url, legacyToken);
      if (migrated) { legacyToken = null; legacyBase = null; return migrated; }
    }
    return refresh(url);
  };
  const restore = (url) => {
    if (restoring) return restoring;
    restoring = restoreOnce(url).finally(() => { restoring = null; });
    return restoring;
  };
  const restoreOffline = (account,url) => {
    if (current(url) || !account?.id || !Number.isFinite(account.expiresAt) || account.expiresAt <= Date.now()) return current(url);
    base = url;
    user = {id:account.id,name:'',email:'',token:'',offlineOnly:true,sessionExpired:false,emailVerified:true,sessionKey:++generation,expiresAt:account.expiresAt};
    notify();
    return user;
  };
  return { current, clear, refresh, restore, restoreOffline, subscribe: listener => { listeners.add(listener); return () => { listeners.delete(listener); }; }, set: (body, url) => { generation++; legacyToken = null; legacyBase = null; return accept(body, url); } };
}
