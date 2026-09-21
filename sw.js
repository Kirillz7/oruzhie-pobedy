/* =========================================================
   Service Worker — «Оружие Победы»
   Cache-first с подмешиванием свежих данных из сети.
   ВАЖНО: cloud.js и Firebase SDK идут в обход кэша —
   иначе браузер отказывается исполнять ES-модули.
   ========================================================= */
const CACHE = 'ovp-pobeda-v7';

const ASSETS = [
  './',
  './index.html',
  './admin.html',
  './css/style.css',
  './js/data.js',
  './js/utils.js',
  './js/games-extra.js',
  './js/app.js',
  './js/admin.js',
  './manifest.json',
  './images/icon.svg'
  // ВНИМАНИЕ: cloud.js здесь НЕ указан — он должен всегда тянуться из сети
];

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE)
      .then(cache => cache.addAll(ASSETS))
      .then(() => self.skipWaiting())
      .catch(err => console.warn('[SW] install:', err))
  );
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(
        keys.filter(k => k !== CACHE).map(k => caches.delete(k))
      ))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', event => {
  const req = event.request;
  if (req.method !== 'GET') return;

  const url = new URL(req.url);

  /* === 1. Пропускаем всё внешнее (Firebase SDK, Google Fonts и т.п.) ===
     Иначе SW закэширует opaque-ответы и браузер откажется
     исполнять их как ES-модули. */
  if (url.origin !== location.origin) return;

  /* === 2. cloud.js — всегда из сети, не кэшируем ===
     Это ES-модуль с импортами. Если отдать из кэша — упадёт. */
  if (url.pathname.endsWith('/js/cloud.js')) return;

  /* === 3. Навигация (открытие страниц) === */
  if (req.mode === 'navigate'){
    event.respondWith(
      fetch(req)
        .then(res => {
          const copy = res.clone();
          caches.open(CACHE).then(c => c.put(req, copy)).catch(() => {});
          return res;
        })
        .catch(() => caches.match(req).then(c => c || caches.match('./index.html')))
    );
    return;
  }

  /* === 4. Остальное: cache-first, потом сеть === */
  event.respondWith(
    caches.match(req).then(cached => {
      if (cached) return cached;
      return fetch(req).then(res => {
        // Кэшируем только успешные same-origin ответы (не opaque!)
        if (res && res.status === 200 && res.type === 'basic'){
          const copy = res.clone();
          caches.open(CACHE).then(c => c.put(req, copy)).catch(() => {});
        }
        return res;
      }).catch(() => {
        if (req.destination === 'image') return new Response('', { status: 404 });
      });
    })
  );
});

self.addEventListener('message', event => {
  if (event.data === 'skipWaiting') self.skipWaiting();
});
