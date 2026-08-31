/* Stride service worker — app shell offline + map tile cache */
const SHELL = 'stride-shell-v3';
const TILES = 'stride-tiles-v1';
const ASSETS = [
  './', './index.html', './manifest.webmanifest',
  './vendor/leaflet.css', './vendor/leaflet.js',
  './vendor/fonts/barlow-condensed-700.woff2', './vendor/fonts/barlow-condensed-800.woff2'
];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(SHELL).then(c => c.addAll(ASSETS.map(u => new Request(u, {mode:'cors'})))).catch(()=>{}).then(() => self.skipWaiting()));
});
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(k => Promise.all(k.filter(n => n !== SHELL && n !== TILES).map(n => caches.delete(n)))).then(() => self.clients.claim()));
});
self.addEventListener('fetch', e => {
  const req = e.request;
  if(req.method !== 'GET') return;
  const url = new URL(req.url);
  const isTile = /basemaps\.cartocdn\.com|tile\.openstreetmap\.org/.test(url.hostname);

  if(isTile){
    e.respondWith(caches.open(TILES).then(async cache => {
      const hit = await cache.match(req);
      const net = fetch(req).then(r => { if(r.ok) cache.put(req, r.clone()); return r; }).catch(() => hit);
      return hit || net;
    }));
    return;
  }
  e.respondWith(caches.match(req).then(hit => hit || fetch(req).then(r => {
    if(r.ok && (url.origin === location.origin || false)){
      const copy = r.clone(); caches.open(SHELL).then(c => c.put(req, copy));
    }
    return r;
  }).catch(() => caches.match('./index.html'))));
});
