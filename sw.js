const CACHE_NAME = 'stayjp-v129';
const ASSETS = [
  './',
  './index.html',
  './home.html',
  './verbs.html',
  './contact.html',
  // vocab-n*.js / grammar-n*.js / confusables.js 移除：資料已搬 Firestore content/master，
  // 由 content-loader.js 取 + localStorage 快取
  './content-loader.js',
  './grammar-kanji-readings.js',
  './quiz.js',
  './srs.js',
  './stats.js',
  './grammar-drill.js',
  './virtual-list.js',
  './calendar.js',
  './mock-exam.js',
  './reading.js',
  './listening.js',
  './flashcard.js',
  './stayjpplan.png',
  './stayjpplan-192.png',
  './manifest.json',
  './terms.html',
  './privacy.html',
  './refund.html'
];

// Install: cache all assets
self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => cache.addAll(ASSETS))
      .then(() => self.skipWaiting())
  );
});

// 客戶端發 SKIP_WAITING 訊息 → 立刻 activate
self.addEventListener('message', e => {
  if (e.data && e.data.type === 'SKIP_WAITING') self.skipWaiting();
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
