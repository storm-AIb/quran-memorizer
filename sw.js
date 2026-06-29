const CACHE_NAME = 'quran-memorizer-v1';
const ASSETS = [
  './',
  './index.html',
  './styles.css',
  './app.js',
  './manifest.json',
  './og-image.jpg',
  './qr-code.png',
  './icon-192.png',
  './icon-512.png'
];

self.addEventListener('install', (e) => {
  e.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(ASSETS);
    }).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.map((key) => {
          if (key !== CACHE_NAME) {
            return caches.delete(key);
          }
        })
      );
    }).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (e) => {
  const isLocalRequest = e.request.url.startsWith(self.location.origin);
  const isApiRequest = e.request.url.startsWith('https://api.alquran.cloud/');
  
  // Handle GET requests for local assets OR Quran API calls
  if (e.request.method !== 'GET' || (!isLocalRequest && !isApiRequest)) {
    return;
  }
  
  e.respondWith(
    caches.match(e.request).then((cachedResponse) => {
      if (cachedResponse) {
        return cachedResponse;
      }
      return fetch(e.request).then((response) => {
        // Cache newly fetched local assets or API requests
        if (response.status === 200) {
          const responseClone = response.clone();
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(e.request, responseClone);
          });
        }
        return response;
      });
    }).catch(() => {
      // Offline fallback for local document page
      if (isLocalRequest) {
        return caches.match('./index.html');
      }
      return Promise.reject('Offline API request failed');
    })
  );
});
