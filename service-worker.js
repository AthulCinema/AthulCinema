const CACHE_NAME = 'athulcinema-cache-v1';

// List all the files to cache for offline use
const urlsToCache = [
  '/AthulCinema/',
  '/AthulCinema/index.html',
  '/AthulCinema/style.css'
  // Remember to add your icon paths here once you have the images!
];

// Step 1: Install and Cache
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => {
        console.log('Cache opened successfully!');
        return cache.addAll(urlsToCache);
      })
  );
});

// Step 2: Fetch from Network or Cache
self.addEventListener('fetch', (event) => {
  event.respondWith(
    caches.match(event.request)
      .then((response) => {
        if (response) {
          return response; // Return the cached file
        }
        return fetch(event.request); // Otherwise fetch from the web
      })
  );
});

// Step 3: Activate and Clean up
self.addEventListener('activate', (event) => {
  const cacheWhitelist = [CACHE_NAME];
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          if (cacheWhitelist.indexOf(cacheName) === -1) {
            return caches.delete(cacheName);
          }
        })
      );
    })
  );
});
