/* Stride service worker — offline app shell + map tile cache.
   Vite emits hashed asset names, so the shell is cached at runtime:
   every same-origin GET that succeeds is kept for offline use. */
const SHELL = 'stride-react-shell-v1';
const TILES = 'stride-tiles-v1';

self.addEventListener('install', e => {
  e.waitUntil(caches.open(SHELL).then(c => c.addAll(['/'])).catch(() => {}).then(() => self.skipWaiting()));
});
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys()
    .then(k => Promise.all(k.filter(n => n !== SHELL && n !== TILES).map(n => caches.delete(n))))
    .then(() => self.clients.claim()));
});
self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  const isTile = /tile\.openstreetmap\.org|basemaps\.cartocdn\.com/.test(url.hostname);

  if (isTile) {
    e.respondWith(caches.open(TILES).then(async cache => {
      const hit = await cache.match(req);
      const net = fetch(req).then(r => { if (r.ok) cache.put(req, r.clone()); return r; }).catch(() => hit);
      return hit || net;
    }));
    return;
  }
  if (url.hostname.includes('open-meteo.com')) return;   // weather is fetch-and-store, never cached here
  e.respondWith(caches.match(req).then(hit => hit || fetch(req).then(r => {
    if (r.ok && url.origin === location.origin) {
      const copy = r.clone(); caches.open(SHELL).then(c => c.put(req, copy));
    }
    return r;
  }).catch(() => caches.match('/'))));
});
