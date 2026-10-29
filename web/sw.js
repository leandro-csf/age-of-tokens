// Service worker: deixa o jogo abrir sem rede (a casca e os sprites ficam guardados no aparelho).
// So funciona em contexto seguro (localhost ou HTTPS): em http://192.168.x.x o navegador nao registra.
// A API (/api/*) NUNCA e guardada: o estado vem sempre ao vivo do servidor.
const VERSION = 'v1';
const SHELL_CACHE = `aot-shell-${VERSION}`;
const SPRITES_CACHE = 'aot-sprites';   // fora da versao: sao grandes e nao mudam

const SHELL = [
  '/',
  '/index.html',
  '/style.css',
  '/app.js',
  '/world/assets.js',
  '/world/scene.js',
  '/world/actors.js',
  '/world/nav.js',
  '/world/stages.js',
  '/ui/skins.js',
  '/ui/card.js',
  '/fonts/fonts.css',
  '/fonts/jacquard12-400.woff2',
  '/fonts/pixelifysans-400-700.woff2',
  '/fonts/silkscreen-400.woff2',
  '/fonts/silkscreen-700.woff2',
  '/manifest.webmanifest',
  '/icons/icon-192.png',
  '/icons/icon-512.png',
];

self.addEventListener('install', event => {
  // allSettled: um arquivo ausente nao derruba a instalacao inteira
  event.waitUntil((async () => {
    const cache = await caches.open(SHELL_CACHE);
    await Promise.allSettled(SHELL.map(url => cache.add(url)));
    await self.skipWaiting();
  })());
});

self.addEventListener('activate', event => {
  event.waitUntil((async () => {
    for (const key of await caches.keys()) {
      if (key.startsWith('aot-shell-') && key !== SHELL_CACHE) await caches.delete(key);
    }
    await self.clients.claim();
  })());
});

async function cacheFirst(request, name) {
  const cache = await caches.open(name);
  const hit = await cache.match(request);
  if (hit) return hit;
  const res = await fetch(request);
  if (res.ok) cache.put(request, res.clone());
  return res;
}

async function staleWhileRevalidate(request, name) {
  const cache = await caches.open(name);
  const hit = await cache.match(request);
  const fresh = fetch(request).then(res => { if (res.ok) cache.put(request, res.clone()); return res; }).catch(() => null);
  return hit || (await fresh) || Response.error();
}

async function networkFirst(request, name) {
  const cache = await caches.open(name);
  try {
    const res = await fetch(request);
    if (res.ok) cache.put(request, res.clone());
    return res;
  } catch {
    return (await cache.match(request)) || Response.error();
  }
}

self.addEventListener('fetch', event => {
  const { request } = event;
  if (request.method !== 'GET') return;
  const url = new URL(request.url);
  if (url.origin !== location.origin) return;

  if (url.pathname === '/api/content') { event.respondWith(networkFirst(request, SHELL_CACHE)); return; }  // so nomes e constantes
  if (url.pathname.startsWith('/api/')) return;                                                           // estado e stream: sempre ao vivo
  if (url.pathname.startsWith('/assets/')) { event.respondWith(cacheFirst(request, SPRITES_CACHE)); return; }
  if (request.mode === 'navigate') {
    event.respondWith(networkFirst(request, SHELL_CACHE).then(r => (r.type === 'error' ? caches.match('/index.html') : r)));
    return;
  }
  event.respondWith(staleWhileRevalidate(request, SHELL_CACHE));
});
