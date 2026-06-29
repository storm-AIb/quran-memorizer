const CACHE_NAME = 'quran-memorizer-v8';
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
  const url = e.request.url;
  
  // Completely bypass Service Worker interception for audio files (.mp3) or external audio server calls
  // This is critical to prevent Safari from throwing Range Request errors (206) in iOS PWA standalone mode
  if (
    e.request.method !== 'GET' || 
    url.includes('.mp3') || 
    url.startsWith('https://everyayah.com') ||
    !url.startsWith(self.location.origin)
  ) {
    return;
  }
  e.respondWith(
    caches.match(e.request).then((cachedResponse) => {
      if (cachedResponse) {
        return cachedResponse;
      }
      return fetch(e.request).then((response) => {
        if (response.status === 200) {
          const responseClone = response.clone();
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(e.request, responseClone);
          });
        }
        return response;
      });
    }).catch(() => {
      return caches.match('./index.html');
    })
  );
});
