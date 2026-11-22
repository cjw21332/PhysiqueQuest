import * as SecureStore from 'expo-secure-store';
import { validOfflineGrant } from './offlineGrant.mjs';

const key = 'pq.offline.account.v1';
type Grant = { id:string; scope:string; issuedAt:number; expiresAt:number };
let queue = Promise.resolve();

export function handleOfflineAccount(action:string, origin:string, base:string, token?:string):Promise<Grant | null> {
  const scope = JSON.stringify([origin,base]);
  const run = async () => {
    if (action === 'forget-offline-account') { await SecureStore.deleteItemAsync(key); return null; }
    if (action === 'remember-offline-account') {
      if (!token || token.length > 8192) return null;
      const controller = new AbortController();
      const timeout = setTimeout(()=>controller.abort(),8000);
      const response = await fetch(base+'/auth/me',{headers:{Authorization:'Bearer '+token},signal:controller.signal}).finally(()=>clearTimeout(timeout));
      if (!response.ok) return null;
      const user = await response.json();
      if (typeof user.id !== 'string' || !/^[a-f0-9]{24}$/i.test(user.id) || !(user.emailVerified || user.legacyEmailAccess)) return null;
      const issuedAt = Date.now();
      // This device-bound identity preserves offline access indefinitely. It
      // does not carry a server credential; online actions still reauthenticate.
      const grant = {id:user.id,scope,issuedAt,expiresAt:0};
      await SecureStore.setItemAsync(key,JSON.stringify(grant),{keychainAccessible:SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY});
      return grant;
    }
    const raw = await SecureStore.getItemAsync(key);
    if (!raw) return null;
    try {
      const grant = validOfflineGrant(JSON.parse(raw), scope);
      if (!grant) return null;
      const indefinite = { ...grant, expiresAt: 0 };
      if (grant.expiresAt !== 0) {
        await SecureStore.setItemAsync(key,JSON.stringify(indefinite),{keychainAccessible:SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY});
      }
      return { ...indefinite, expiresAt: Number.MAX_SAFE_INTEGER };
    }
    catch { return null; }
  };
  const task = queue.then(run);
  queue = task.then(()=>{},()=>{});
  return task;
}
