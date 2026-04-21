const CACHE_NAME = 'stayjp-v48';
const ASSETS = [
  './',
  './index.html',
  './home.html',
  './verbs.html',
  './contact.html',
  './vocab-n5.js',
  './vocab-n4.js',
  './vocab-n3.js',
  './vocab-n2.js',
  './vocab-n1.js',
  './grammar-n3.js',
  './grammar-n2.js',
  './grammar-n1.js',
  './confusables.js',
  './quiz.js',
  './srs.js',
  './stats.js',
  './grammar-drill.js',
  './virtual-list.js',
  './calendar.js',
  './mock-exam.js',
  './reading.js',
  './listening.js',
  './stayjpplan.png',
  './manifest.json'
];

// Install: cache all assets
self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => cache.addAll(ASSETS))
      .then(() => self.skipWaiting())
  );
});

// Fetch: cache-first, fallback to network
self.addEventListener('fetch', e => {
  e.respondWith(
    caches.match(e.request).then(cached => {
      return cached || fetch(e.request).then(response => {
        // Cache successful GET responses for future use
        if (e.request.method === 'GET' && response.status === 200) {
          const clone = response.clone();
          caches.open(CACHE_NAME).then(cache => cache.put(e.request, clone));
        }
        return response;
      });
    })
  );
});

// Activate: clean old caches
self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(
        keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k))
      )
    ).then(() => self.clients.claim())
  );
});
