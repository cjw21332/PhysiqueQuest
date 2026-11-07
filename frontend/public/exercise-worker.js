const CACHE = 'physiquequest-offline-exercises-v5';
const MEDIA_CACHE = 'physiquequest-viewed-exercise-media-v1';
const MAX_MEDIA = 6;
const candidates = new Map();
let mediaQueue = Promise.resolve();
const mediaUrl = value => { try { const url = new URL(value); return url.protocol === 'https:' && url.hostname === 'static.exercisedb.dev' && /^\/media\/[A-Za-z0-9_-]+\.gif$/.test(url.pathname) && !url.search && !url.hash; } catch { return false; } };
const ASSETS = ['/offline-exercises.html', '/offline-exercises.js', '/offline-exercises.css', '/physiquequest-icon.png'];
self.addEventListener('install', event => { event.waitUntil(caches.open(CACHE).then(cache => cache.addAll(ASSETS))); });
self.addEventListener('activate', event => { event.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(key => key.startsWith('physiquequest-offline-exercises-') && key !== CACHE).map(key => caches.delete(key)))).then(() => self.clients.claim())); });
self.addEventListener('fetch', event => {
  const request = event.request, url = new URL(request.url);
  if (request.method === 'GET' && request.destination === 'image' && mediaUrl(request.url)) {
    event.respondWith((async () => {
      try {
        const cache = await caches.open(MEDIA_CACHE);
        const saved = await cache.match(request.url);
        if (saved) return saved;
      } catch { /* Network playback must still work when device storage fails. */ }
      const response = await fetch(request);
      if (response.ok || response.type === 'opaque') {
        candidates.set(request.url, response.clone());
        while (candidates.size > MAX_MEDIA) candidates.delete(candidates.keys().next().value);
      }
      return response;
    })());
    return;
  }
  if (request.method !== 'GET' || url.origin !== self.location.origin) return;
  if (request.mode === 'navigate') {
    event.respondWith(fetch(request).catch(async () => (await caches.open(CACHE)).match('/offline-exercises.html')));
  } else if (ASSETS.includes(url.pathname)) {
    event.respondWith(caches.open(CACHE).then(async cache => (await cache.match(url.pathname)) || fetch(request)));
  }
});
self.addEventListener('message', event => {
  const data = event.data, reply = event.ports?.[0];
  if (!reply || !data || !['MEDIA_STATUS', 'MEDIA_VIEWED'].includes(data.type) || !mediaUrl(data.url)) return;
  const task = async () => {
    try {
      const source = event.source && 'url' in event.source ? new URL(event.source.url) : null;
      if (!source || source.origin !== self.location.origin) return reply.postMessage({ cached: false });
      const cache = await caches.open(MEDIA_CACHE);
      const saved = await cache.match(data.url);
      if (data.type === 'MEDIA_VIEWED') {
        const candidate = saved || candidates.get(data.url);
        candidates.delete(data.url);
        if (candidate) {
          const estimate = await self.navigator.storage?.estimate?.();
          if (saved || !estimate?.quota || (estimate.usage || 0) / estimate.quota < 0.8) {
            if (saved) await cache.delete(data.url);
            await cache.put(data.url, candidate);
            const keys = await cache.keys();
            for (const key of keys.slice(0, Math.max(0, keys.length - MAX_MEDIA))) await cache.delete(key);
          }
        }
      }
      reply.postMessage({ cached: Boolean(await cache.match(data.url)) });
    } catch { reply.postMessage({ cached: false }); }
  };
  mediaQueue = mediaQueue.catch(() => {}).then(task);
  event.waitUntil(mediaQueue);
});
