/* =========================================================
   Service Worker — «Оружие Победы»
   Cache-first с подмешиванием свежих данных из сети.

   ВАЖНО:
   - cloud.js НЕ кэшируется — всегда тянется из сети.
   - updates.js — НЕ кэшируется, чтобы новая версия подхватывалась сразу.
   - Внешние скрипты (Firebase SDK, Google Fonts) не перехватываются.

   При изменении файлов — поднять CACHE (v14 → v15 → ...)
   и обновить APP_VERSION в js/updates.js.
   ========================================================= */
const CACHE = 'ovp-pobeda-v14';

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
  // cloud.js — НЕ в кэше, всегда из сети (ES-модуль)
  // updates.js — НЕ в кэше, всегда из сети (чтобы быстро узнавать об обновлениях)
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

  /* 1. Внешние домены — мимо кэша (Firebase SDK, Google Fonts) */
  if (url.origin !== location.origin) return;

  /* 2. Файлы, которые нельзя кэшировать — всегда из сети */
  if (url.pathname.endsWith('/js/cloud.js')) return;
  if (url.pathname.endsWith('/js/updates.js')) return;
  if (url.pathname.endsWith('/sw.js')) return;

  /* 3. Навигация (открытие страниц) */
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

  /* 4. Остальное: cache-first, потом сеть */
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


/* =========================================================
   ФОТО-СИЛУЭТЫ (игра «Угадай по силуэту»)
   Цветное фото с прозрачным фоном превращается в чёрный
   силуэт через CSS-фильтр. В тёмной теме — в белый, чтобы
   было видно на чёрном фоне.
   ========================================================= */
.sil-img__photo{
  max-width:80%;
  max-height:80%;
  object-fit:contain;
  filter:brightness(0);
  user-select:none;
}
html[data-theme="dark"] .sil-img__photo{
  filter:brightness(0) invert(1);
}
