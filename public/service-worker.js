// KPI Bonus - Service Worker
//
// MUHIM: bu ilova doim JONLI ma'lumot (KPI, kassa, bonus) bilan ishlaydi.
//  - API so'rovlari (/api/...) HECH QACHON keshlanmaydi.
//  - Sahifalar, CSS va JS fayllari "tarmoqdan birinchi" olinadi: internet bor bo'lsa har doim
//    eng yangi versiya ishlaydi (eskirgan kod yangi API bilan aralashib, noto'g'ri
//    ma'lumot ko'rsatmasligi uchun). Kesh faqat internet YO'Q paytda zaxira sifatida ishlatiladi.

const CACHE_NAME = 'kpi-bonus-v12';
const PRECACHE = [
  '/css/style.css',
  '/js/i18n.js',
  '/js/api.js',
  '/js/topbar.js',
  '/js/categoryOrder.js',
  '/img/logo.png',
  '/img/icon-192.png',
  '/img/icon-512.png',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(PRECACHE)).catch(() => {})
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((names) =>
      Promise.all(names.filter((n) => n !== CACHE_NAME).map((n) => caches.delete(n)))
    )
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;

  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;
  if (url.pathname.startsWith('/api/')) return; // API - brauzerning odatiy tarmoq so'roviga qoldiramiz

  event.respondWith(
    fetch(req)
      .then((res) => {
        if (res && res.ok) {
          const copy = res.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(req, copy)).catch(() => {});
        }
        return res;
      })
      .catch(() => caches.match(req))
  );
});
