const CACHE = 'kuvo-static-v3';
const OFFLINE_URL = '/offline.html';

const STATIC_ASSETS = [
  '/icons/icon-192.png',
  '/icons/icon-512.png',
  '/manifest.webmanifest',
  OFFLINE_URL,
];

const BLOCKED_PREFIXES = ['/panel', '/admin', '/auth', '/api'];

function isBlockedPath(pathname) {
  return BLOCKED_PREFIXES.some(
    prefix => pathname === prefix || pathname.startsWith(`${prefix}/`),
  );
}

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE)
      .then(cache => cache.addAll(STATIC_ASSETS))
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(key => key !== CACHE).map(key => caches.delete(key))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener('fetch', event => {
  const request = event.request;
  if (request.method !== 'GET') return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;
  if (isBlockedPath(url.pathname)) return;

  const cacheableStatic =
    url.pathname.startsWith('/icons/')
    || url.pathname.startsWith('/brand/')
    || url.pathname === '/manifest.webmanifest'
    || url.pathname === OFFLINE_URL;

  if (!cacheableStatic) {
    event.respondWith(
      fetch(request).catch(async () => {
        if (request.mode === 'navigate') {
          return caches.match(OFFLINE_URL);
        }
        return Response.error();
      }),
    );
    return;
  }

  event.respondWith(
    caches.match(request).then(cached => {
      if (cached) return cached;
      return fetch(request).then(response => {
        if (!response.ok || response.redirected) return response;
        const copy = response.clone();
        caches.open(CACHE).then(cache => cache.put(request, copy));
        return response;
      });
    }).catch(() => caches.match(OFFLINE_URL) || Response.error()),
  );
});
