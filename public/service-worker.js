// KPI Bonus - Service Worker
//
// MUHIM: bu ilova doim JONLI ma'lumot (KPI, kassa, bonus) bilan ishlaydi,
// shuning uchun API so'rovlari (/api/...) HECH QACHON keshlanmaydi - har doim
// tarmoqdan yangi ma'lumot olinadi. Faqat DIZAYN fayllari (CSS, JS, rasmlar)
// tezroq yuklanishi uchun keshlanadi.

const CACHE_NAME = 'kpi-bonus-v3';
const STATIC_ASSETS = [
  '/css/style.css',
  '/js/api.js',
  '/js/topbar.js',
  '/js/categoryOrder.js',
  '/img/logo.png',
  '/img/icon-192.png',
  '/img/icon-512.png',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(STATIC_ASSETS)).catch(() => {})
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
  const url = new URL(event.request.url);

  // API so'rovlari - hech qachon keshlanmaydi, doim tarmoqdan
  if (url.pathname.startsWith('/api/')) {
    return; // brauzerning o'z odatiy tarmoq so'roviga qoldiramiz
  }

  // Statik fayllar (CSS/JS/rasm) - avval keshdan, bo'lmasa tarmoqdan
  if (STATIC_ASSETS.some((asset) => url.pathname === asset)) {
    event.respondWith(
      caches.match(event.request).then((cached) => cached || fetch(event.request))
    );
    return;
  }

  // HTML sahifalar - avval tarmoqdan (eng yangi holatni ko'rsatish uchun),
  // faqat internet yo'q bo'lsa keshdan
  event.respondWith(
    fetch(event.request).catch(() => caches.match(event.request))
  );
});
