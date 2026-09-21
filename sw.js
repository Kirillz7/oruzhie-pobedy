/* =========================================================
   Service Worker — «Оружие Победы»
   Cache-first с подмешиванием свежих данных из сети.

   ВАЖНО:
   - cloud.js НЕ кэшируется — всегда тянется из сети.
   - Внешние скрипты (Firebase SDK, Google Fonts, QR-API)
     не перехватываются.
   - В кэш попадают только same-origin ответы типа «basic».
   При изменении файлов — поднять CACHE (v10 → v11 → ...).
   ========================================================= */
const CACHE = 'ovp-pobeda-v10';

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
  // cloud.js — НЕ в кэше, модуль всегда из сети.
  // Внешние скрипты (Firebase SDK) — тоже мимо кэша.
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

  /* 1. Внешние домены пропускаем (Firebase SDK, Google Fonts,
        api.qrserver.com). Иначе SW может закэшировать opaque-ответы. */
  if (url.origin !== location.origin) return;

  /* 2. cloud.js — всегда из сети. */
  if (url.pathname.endsWith('/js/cloud.js')) return;

  /* 3. Навигация (открытие страниц). */
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

  /* 4. Остальное: cache-first, потом сеть. */
  event.respondWith(
    caches.match(req).then(cached => {
      if (cached) return cached;
      return fetch(req).then(res => {
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
