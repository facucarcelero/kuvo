const CACHE = 'kuvo-static-v2';
const OFFLINE_URL = '/offline.html';

const STATIC_ASSETS = [
  '/',
  '/explorar',
  '/login',
  '/registro',
  '/icons/icon-192.png',
  '/icons/icon-512.png',
  '/manifest.webmanifest',
  OFFLINE_URL,
];

const BLOCKED_PREFIXES = ['/panel', '/admin', '/auth', '/api'];

function isBlockedPath(pathname: string): boolean {
  return BLOCKED_PREFIXES.some(prefix => pathname === prefix || pathname.startsWith(`${prefix}/`));
}

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE)
      .then(cache => cache.addAll(STATIC_ASSETS))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(key => key !== CACHE).map(key => caches.delete(key))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', event => {
  const request = event.request;
  if (request.method !== 'GET') return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;
  if (isBlockedPath(url.pathname)) return;
  if (request.mode === 'navigate' && isBlockedPath(url.pathname)) return;

  event.respondWith(
    fetch(request)
      .then(response => {
        if (!response.ok || response.redirected) return response;
        if (url.pathname.startsWith('/icons/') || url.pathname.startsWith('/brand/')) {
          const copy = response.clone();
          caches.open(CACHE).then(cache => cache.put(request, copy));
        }
        return response;
      })
      .catch(async () => {
        const cached = await caches.match(request);
        if (cached) return cached;
        if (request.mode === 'navigate') {
          return caches.match('/') || caches.match(OFFLINE_URL);
        }
        return Response.error();
      })
  );
});
