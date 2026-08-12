const CACHE_VERSION = "lux-v1.0.0";
const urlsToCache = ['./', './index.html', './manifest.json'];

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_VERSION).then(cache => cache.addAll(urlsToCache))
  );
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(cacheNames => {
      return Promise.all(
        cacheNames.filter(name => name !== CACHE_VERSION).map(old => caches.delete(old))
      );
    }).then(() => {
      self.clients.matchAll().then(all => {
        all.forEach(client => {
          client.postMessage({ type: "SW_UPDATED", version: CACHE_VERSION });
        });
      });
    })
  );
});

self.addEventListener('fetch', event => {
  event.respondWith(
    caches.match(event.request).then(response => response || fetch(event.request))
  );
});