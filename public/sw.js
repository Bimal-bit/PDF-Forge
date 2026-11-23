/* global self, caches, fetch, URL, Response */
const CACHE = 'pdfforge-shell-v5';
self.addEventListener('install', (event) => event.waitUntil((async () => {
  const response = await fetch('/precache.json', { cache: 'no-store' });
  if (!response.ok) throw new Error('Could not load the offline asset list.');
  const assets = await response.json();
  const cache = await caches.open(CACHE);
  await cache.addAll(['/', '/index.html', '/manifest.webmanifest', ...assets]);
})()));
self.addEventListener('activate', (event) => event.waitUntil(caches.keys().then(async (keys) => {
  await Promise.all(keys.filter((key) => key.startsWith('pdfforge-shell-') && key !== CACHE).map((key) => caches.delete(key)));
  await self.clients.claim();
})));
self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET' || new URL(event.request.url).origin !== self.location.origin) return;
  const fromNetwork = async () => {
    const response = await fetch(event.request);
    if (response.ok) {
      const cache = await caches.open(CACHE);
      await cache.put(event.request, response.clone());
      if (event.request.mode === 'navigate') await cache.put('/index.html', response.clone());
    }
    return response;
  };
  if (event.request.mode === 'navigate') {
    event.respondWith(fromNetwork().catch(async () => (await caches.match('/index.html')) || Response.error()));
    return;
  }
  event.respondWith(caches.match(event.request, { ignoreVary: true }).then((cached) => cached || fromNetwork()).catch(() => Response.error()));
});
