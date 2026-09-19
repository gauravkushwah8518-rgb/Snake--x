const CACHE_NAME = 'snake-x-v2.1.3';
const APP_BASE = new URL('./', self.location).href;

// Core shell — hashed assets are cached on first fetch instead of being hardcoded,
// so new deploys never break the SW (no more editing this file on every build).
const CORE_ASSETS = [
  './',
  './index.html',
  './manifest.json',
  './assets/style.css',
  './assets/game.js',
  './assets/icons/icon-192.png',
  './assets/icons/icon-512.png'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(CORE_ASSETS)).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((names) => Promise.all(names.map((n) => (n === CACHE_NAME ? null : caches.delete(n)))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;

  event.respondWith(
    (async () => {
      const cache = await caches.open(CACHE_NAME);

      // Static assets: cache-first (they are fingerprinted by name or versioned by cache)
      const url = new URL(request.url);
      const isAsset = url.origin === self.location.origin && url.pathname.includes('/assets/');

      if (isAsset) {
        const cached = await cache.match(request);
        if (cached) return cached;
        try {
          const fresh = await fetch(request);
          if (fresh && fresh.status === 200) cache.put(request, fresh.clone());
          return fresh;
        } catch {
          const fallback = await cache.match('./index.html');
          return fallback || Response.error();
        }
      }

      // Navigation & everything else: network-first with cache fallback (fixes stale HTML)
      try {
        const fresh = await fetch(request);
        if (fresh && fresh.status === 200 && fresh.type === 'basic') {
          cache.put(request, fresh.clone());
        }
        return fresh;
      } catch {
        const cached = await cache.match(request);
        if (cached) return cached;
        if (request.mode === 'navigate') {
          return (await cache.match('./index.html')) || (await cache.match(APP_BASE)) || Response.error();
        }
        return Response.error();
      }
    })()
  );
});
