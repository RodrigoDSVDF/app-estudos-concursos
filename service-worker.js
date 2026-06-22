/* ================================================================
 * service-worker.js — Corrigido para Auth Callback e PWA
 * ================================================================ */

const SW_VERSION = 'aprovado-v2.2.1'; 
const PRECACHE_NAME = `${SW_VERSION}-precache`;
const RUNTIME_CACHE = `${SW_VERSION}-runtime`;
const CDN_CACHE = `${SW_VERSION}-cdn`;
const API_CACHE = `${SW_VERSION}-api`;

// URLs para pré-cache
const PRECACHE_URLS = [
  './',
  './index.html',
  './404.html',
  './manifest.json',
  './css/style.css',
  './js/utils.js',
  './js/supabase-client.js',
  './js/supabase-auth.js',
  './js/login-screen.js',
  './js/db.js',
  './js/seed.js',
  './js/concursos.js',
  './js/materias.js',
  './js/conteudos.js',
  './js/sessoes.js',
  './js/anotacoes.js',
  './js/revisoes.js',
  './js/dashboard.js',
  './js/insights.js',
  './js/backup.js',
  './js/app.js',
  './assets/icons/icon-192.png',
  './assets/icons/icon-512.png',
  './assets/icons/apple-touch-icon.png',
  './assets/icons/favicon.svg',
  './offline.html'
];

const CDN_ORIGINS = ['https://cdn.jsdelivr.net', 'https://fonts.googleapis.com', 'https://fonts.gstatic.com'];
const SUPABASE_ORIGIN = 'https://zryovbcyhecxwduzdpme.supabase.co';

/* ---------- INSTALAÇÃO ---------- */
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(PRECACHE_NAME).then(cache => {
      return Promise.allSettled(PRECACHE_URLS.map(url => cache.add(url)));
    }).then(() => self.skipWaiting())
  );
});

/* ---------- ATIVAÇÃO ---------- */
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys => {
      return Promise.all(
        keys.filter(key => !key.startsWith(SW_VERSION))
            .map(key => caches.delete(key))
      );
    }).then(() => self.clients.claim())
  );
});

/* ---------- FETCH (CORRIGIDO) ---------- */
self.addEventListener('fetch', event => {
  const req = event.request;
  const url = new URL(req.url);

  // --- CORREÇÃO CRÍTICA: Ignorar o Service Worker para rotas de autenticação ---
  // Isso evita que o SW "sequestre" o redirecionamento do Google/Supabase
  if (url.pathname.includes('/auth/v1/callback')) return;
  // ----------------------------------------------------------------------------

  if (req.method !== 'GET') return;
  if (url.pathname.endsWith('.map')) return;

  // Supabase API → Network First
  if (url.origin === SUPABASE_ORIGIN) {
    event.respondWith(networkFirst(req, API_CACHE));
    return;
  }

  // CDN libraries → Stale While Revalidate
  if (CDN_ORIGINS.some(origin => url.origin === origin)) {
    event.respondWith(staleWhileRevalidate(req, CDN_CACHE));
    return;
  }

  // Navegação (HTML) → Network First
  if (req.mode === 'navigate' || (req.headers.get('accept') || '').includes('text/html')) {
    event.respondWith(networkFirstHTML(req));
    return;
  }

  // Assets do app → Cache First
  if (url.origin === self.location.origin) {
    event.respondWith(cacheFirst(req, RUNTIME_CACHE));
    return;
  }

  event.respondWith(fetch(req).catch(() => caches.match(req)));
});

/* ---------- ESTRATÉGIAS ---------- */

async function cacheFirst(req, cacheName) {
  const cached = await caches.match(req);
  if (cached) return cached;
  const resp = await fetch(req);
  if (resp && resp.ok) {
    const cache = await caches.open(cacheName);
    cache.put(req, resp.clone());
  }
  return resp;
}

async function staleWhileRevalidate(req, cacheName) {
  const cache = await caches.open(cacheName);
  const cached = await cache.match(req);
  const fetchPromise = fetch(req).then(resp => {
    if (resp && resp.ok) cache.put(req, resp.clone());
    return resp;
  }).catch(() => cached);
  return cached || fetchPromise;
}

async function networkFirst(req, cacheName) {
  try {
    const resp = await fetch(req);
    if (resp && resp.ok) {
      const cache = await caches.open(cacheName);
      cache.put(req, resp.clone());
    }
    return resp;
  } catch (err) {
    return (await caches.match(req)) || new Response(JSON.stringify({error: 'offline'}), {status: 503});
  }
}

async function networkFirstHTML(req) {
  try {
    const resp = await fetch(req);
    return resp;
  } catch (err) {
    const cached = await caches.match(req);
    if (cached) return cached;
    return caches.match('./index.html') || caches.match('./offline.html');
  }
}

self.addEventListener('message', event => {
  if (event.data && event.data.type === 'SKIP_WAITING') self.skipWaiting();
});
