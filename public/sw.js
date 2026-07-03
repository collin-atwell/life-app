// Health Hub service worker — network-first with cache fallback, so the app
// keeps working offline once visited, but never serves stale code when online.
const CACHE = 'health-hub-v1';

self.addEventListener('install', () => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  // Only handle same-origin GETs — API calls (e.g. Supabase) pass through untouched.
  if (request.method !== 'GET' || !request.url.startsWith(self.location.origin)) return;
  event.respondWith(
    caches.open(CACHE).then(async (cache) => {
      try {
        const fresh = await fetch(request);
        if (fresh.ok) cache.put(request, fresh.clone());
        return fresh;
      } catch {
        const cached = await cache.match(request, { ignoreSearch: true });
        if (cached) return cached;
        if (request.mode === 'navigate') {
          const shell = await cache.match('./index.html') ?? await cache.match('index.html');
          if (shell) return shell;
        }
        return Response.error();
      }
    }),
  );
});

// Seam for future backend push: a web-push payload sent from a server
// (e.g. Supabase Edge Function) lands here even when the app is closed.
self.addEventListener('push', (event) => {
  const data = (() => { try { return event.data?.json() ?? {}; } catch { return {}; } })();
  event.waitUntil(
    self.registration.showNotification(data.title ?? '⚡ Health Hub', {
      body: data.body ?? '',
      icon: 'icon-192.png',
    }),
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clients) => {
      const existing = clients.find((c) => 'focus' in c);
      return existing ? existing.focus() : self.clients.openWindow('.');
    }),
  );
});
