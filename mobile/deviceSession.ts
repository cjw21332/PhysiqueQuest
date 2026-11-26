import * as SecureStore from 'expo-secure-store';

// The WebView cannot keep the API's refresh cookie reliably (it is cross-site, and Android flushes
// cookies to disk lazily, so a killed app can reopen with an already-rotated token). The shell keeps
// a separate device session's refresh token in the secure store instead; the page never sees it.
const key = 'pq.device.session.v1';
type Stored = { scope: string; userId: string; token: string };
export type DeviceRefresh = { status: 'ok'; session: { access_token: string; expires_in: number; user: { id: string } } } | { status: 'none' | 'unauthorized' | 'error' };

const TOKEN = /^[a-f0-9]{64}\.[a-f0-9]{64}$/;
const headers = { 'Content-Type': 'application/json', 'X-PQ-Device': '1' };
let queue: Promise<unknown> = Promise.resolve();
// Rotations are serialised: two concurrent refreshes with one token would look like token reuse.
function serial<T>(run: () => Promise<T>): Promise<T> { const task = queue.then(run); queue = task.then(() => {}, () => {}); return task; }

async function read(scope: string): Promise<Stored | null> {
  try {
    const value = JSON.parse((await SecureStore.getItemAsync(key)) ?? 'null');
    return value && value.scope === scope && typeof value.userId === 'string' && TOKEN.test(value.token) ? value : null;
  } catch { return null; }
}
const write = (value: Stored) => SecureStore.setItemAsync(key, JSON.stringify(value), { keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY });
function post(url: string, body: unknown, bearer?: string) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 20_000);
  return fetch(url, { method: 'POST', headers: bearer ? { ...headers, Authorization: `Bearer ${bearer}` } : headers, body: JSON.stringify(body), signal: controller.signal }).finally(() => clearTimeout(timer));
}

/** After sign-in: create this device's own session unless one already exists for the same account. */
export function linkDeviceSession(origin: string, base: string, accessToken: string, userId?: string) {
  const scope = JSON.stringify([origin, base]);
  return serial(async () => {
    const current = await read(scope);
    if (current && (!userId || current.userId === userId)) return true;
    if (current) await post(`${base}/auth/session/device/logout`, { token: current.token }).catch(() => null);
    const response = await post(`${base}/auth/session/device`, {}, accessToken);
    if (!response.ok) return false;
    const body = await response.json();
    if (!TOKEN.test(body?.device_token) || typeof body.user_id !== 'string') return false;
    await write({ scope, userId: body.user_id, token: body.device_token });
    return true;
  });
}

/** Exchanges the stored token for a fresh access token, saving the rotated token before returning. */
export function refreshDeviceSession(origin: string, base: string): Promise<DeviceRefresh> {
  const scope = JSON.stringify([origin, base]);
  return serial(async (): Promise<DeviceRefresh> => {
    const current = await read(scope);
    if (!current) return { status: 'none' };
    let response: Response;
    try { response = await post(`${base}/auth/session/device/refresh`, { token: current.token }); }
    catch { return { status: 'error' }; }
    if (response.status === 401) { await SecureStore.deleteItemAsync(key); return { status: 'unauthorized' }; }
    if (!response.ok) return { status: 'error' };
    const body = await response.json().catch(() => null);
    if (!body || !TOKEN.test(body.device_token) || typeof body.access_token !== 'string' || body.user?.id !== current.userId) return { status: 'error' };
    await write({ ...current, token: body.device_token });
    const { device_token: _rotated, ...session } = body;
    return { status: 'ok', session };
  });
}

/** Logout or account switch: revoke the device session on the server (best effort) and forget it. */
export function forgetDeviceSession(base: string) {
  return serial(async () => {
    try {
      const value = JSON.parse((await SecureStore.getItemAsync(key)) ?? 'null');
      await SecureStore.deleteItemAsync(key);
      if (value?.token && TOKEN.test(value.token)) await post(`${base}/auth/session/device/logout`, { token: value.token }).catch(() => null);
    } catch { await SecureStore.deleteItemAsync(key).catch(() => {}); }
  });
}
