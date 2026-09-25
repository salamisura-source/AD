const CACHE = 'produzione-touch-v1';
const SHELL = [
  './',
  './index.html',
  './app.js',
  './manifest.json',
  './produzione_dipendenze.csv',
  './vendor/xlsx.mini.min.js',
  './icons/icon.svg',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './icons/apple-touch-icon.png',
  './favicon.png'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE).then((cache) => cache.addAll(SHELL)).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((key) => key !== CACHE).map((key) => caches.delete(key))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;
  const url = new URL(event.request.url);
  if (url.origin !== self.location.origin) return;
  event.respondWith((async () => {
    try {
      const fresh = await fetch(event.request);
      if (fresh && fresh.ok) {
        const cache = await caches.open(CACHE);
        cache.put(event.request, fresh.clone());
      }
      return fresh;
    } catch (error) {
      const cached = await caches.match(event.request);
      if (cached) return cached;
      throw error;
    }
  })());
});
