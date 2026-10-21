export function createSession({ fetcher = (...args) => fetch(...args), storage = () => undefined, headers = () => ({}) } = {}) {
  let user = null, base = null, generation = 0, pending = null, restoring = null, legacyToken = null, legacyBase = null;
  const current = (url) => !url || url === base ? user : null;
  const clear = () => { user = null; base = null; legacyToken = null; legacyBase = null; generation++; };
  const accept = (body, url) => {
    if (body.refresh_token || typeof body.access_token !== 'string' || !body.user?.id || typeof body.expires_in !== 'number') throw Error('Invalid session response');
    base = url;
    user = { ...body.user, token: body.access_token, sessionKey: generation, expiresAt: Date.now() + body.expires_in * 1000 };
    return user;
  };
  const request = async (url, legacy) => {
    const revision = generation;
    const operation = async () => {
      const response = await fetcher(`${url}/auth/session/${legacy ? 'migrate' : 'refresh'}`, {
        method: 'POST', credentials: 'include', headers: { 'Content-Type': 'application/json', ...headers(), ...(legacy ? { Authorization: `Bearer ${legacy}` } : {}) }, body: '{}', signal: AbortSignal.timeout(15_000),
      });
      if (revision !== generation) return null;
      if (response.status === 401) { clear(); return null; }
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
  return { current, clear, refresh, restore, set: (body, url) => { generation++; legacyToken = null; legacyBase = null; return accept(body, url); } };
}
