/* ================================================================
 * service-worker.js — PWA offline support for Aprovado
 *
 * Estratégias de cache:
 * 1. PRECACHE: assets estáticos do app (HTML, CSS, JS, ícones)
 *    → Cache First (fallback network)
 * 2. CDN libraries (Chart.js, Supabase, etc.)
 *    → Stale While Revalidate
 * 3. Supabase API (REST + Auth)
 *    → Network First (fallback cache, só para GETs)
 * 4. Navegação (HTML)
 *    → Network First com fallback para index.html offline
 *
 * Versão: 1.0.0 — bump para forçar update do cache
 * ================================================================ */

const SW_VERSION = 'aprovado-v2.2.0';  // bumped: fix race condition OAuth vs pushState
const PRECACHE_NAME = `${SW_VERSION}-precache`;
const RUNTIME_CACHE = `${SW_VERSION}-runtime`;
const CDN_CACHE = `${SW_VERSION}-cdn`;
const API_CACHE = `${SW_VERSION}-api`;

// URLs para pré-cache (assets críticos do app)
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

// CDNs permitidos (Stale While Revalidate)
const CDN_ORIGINS = [
  'https://cdn.jsdelivr.net',
  'https://fonts.googleapis.com',
  'https://fonts.gstatic.com'
];

// Origem do Supabase (Network First para API)
const SUPABASE_ORIGIN = 'https://zryovbcyhecxwduzdpme.supabase.co';

/* ---------- INSTALL: pré-cacheia assets críticos ---------- */
self.addEventListener('install', event => {
  console.log('[SW] Install — versão', SW_VERSION);
  event.waitUntil(
    caches.open(PRECACHE_NAME).then(cache => {
      // addAll falha inteiro se UM arquivo falhar. Fazemos add individual
      // para ignorar arquivos opcionais que possam não existir.
      return Promise.allSettled(
        PRECACHE_URLS.map(url => cache.add(url).catch(err => {
          console.warn('[SW] Não foi possível pré-cachear:', url, err.message);
        }))
      );
    }).then(() => self.skipWaiting())
  );
});

/* ---------- ACTIVATE: limpa caches antigos ---------- */
self.addEventListener('activate', event => {
  console.log('[SW] Activate — versão', SW_VERSION);
  event.waitUntil(
    caches.keys().then(keys => {
      return Promise.all(
        keys.filter(key => !key.startsWith(SW_VERSION))
            .map(key => {
              console.log('[SW] Removendo cache antigo:', key);
              return caches.delete(key);
            })
      );
    }).then(() => self.clients.claim())
  );
});

/* ---------- FETCH: estratégias por tipo de requisição ---------- */
self.addEventListener('fetch', event => {
  const req = event.request;
  const url = new URL(req.url);

  // Ignora requisições não-GET (POST, PUT, DELETE não são cacheáveis)
  if (req.method !== 'GET') return;

  // Ignora extensões de source maps
  if (url.pathname.endsWith('.map')) return;

  // Estratégia 1: Supabase API → Network First (com fallback cache)
  if (url.origin === SUPABASE_ORIGIN) {
    event.respondWith(networkFirst(req, API_CACHE));
    return;
  }

  // Estratégia 2: CDN libraries → Stale While Revalidate
  if (CDN_ORIGINS.some(origin => url.origin === origin)) {
    event.respondWith(staleWhileRevalidate(req, CDN_CACHE));
    return;
  }

  // Estratégia 3: Navegação (HTML) → Network First, fallback offline.html
  if (req.mode === 'navigate' || (req.headers.get('accept') || '').includes('text/html')) {
    event.respondWith(networkFirstHTML(req));
    return;
  }

  // Estratégia 4: Assets do próprio app → Cache First
  if (url.origin === self.location.origin) {
    event.respondWith(cacheFirst(req, RUNTIME_CACHE));
    return;
  }

  // Default: tentar rede, fallback para cache
  event.respondWith(
    fetch(req).catch(() => caches.match(req))
  );
});

/* ---------- ESTRATÉGIAS ---------- */

/** Cache First: tenta cache, senão rede e cacheia. */
async function cacheFirst(req, cacheName) {
  const cached = await caches.match(req);
  if (cached) return cached;
  try {
    const resp = await fetch(req);
    if (resp && resp.ok) {
      const cache = await caches.open(cacheName);
      cache.put(req, resp.clone());
    }
    return resp;
  } catch (err) {
    return new Response('Offline', { status: 503, statusText: 'Offline' });
  }
}

/** Stale While Revalidate: retorna cache imediatamente, atualiza em background. */
async function staleWhileRevalidate(req, cacheName) {
  const cache = await caches.open(cacheName);
  const cached = await cache.match(req);
  const fetchPromise = fetch(req).then(resp => {
    if (resp && resp.ok) cache.put(req, resp.clone());
    return resp;
  }).catch(() => cached);
  return cached || fetchPromise;
}

/** Network First: tenta rede, senão cache. Para APIs do Supabase. */
async function networkFirst(req, cacheName) {
  try {
    const resp = await fetch(req);
    // Só cacheia GETs bem-sucedidos (não cacheia erros de auth)
    if (resp && resp.ok && req.method === 'GET') {
      const cache = await caches.open(cacheName);
      cache.put(req, resp.clone());
    }
    return resp;
  } catch (err) {
    // Sem rede: tenta cache
    const cached = await caches.match(req);
    if (cached) return cached;
    return new Response(
      JSON.stringify({ error: 'offline', message: 'Sem conexão' }),
      { status: 503, headers: { 'Content-Type': 'application/json' } }
    );
  }
}

/** Network First para HTML: fallback para index.html ou offline.html */
async function networkFirstHTML(req) {
  try {
    const resp = await fetch(req);
    // Atualiza cache da página atual
    if (resp && resp.ok) {
      const cache = await caches.open(RUNTIME_CACHE);
      cache.put(req, resp.clone());
    }
    return resp;
  } catch (err) {
    // Sem rede: tenta cache da página, senão index.html, senão offline.html
    const cached = await caches.match(req);
    if (cached) return cached;
    const indexCache = await caches.match('./index.html');
    if (indexCache) return indexCache;
    const offline = await caches.match('./offline.html');
    if (offline) return offline;
    return new Response(
      '<h1>Offline</h1><p>Você está sem conexão.</p>',
      { status: 503, headers: { 'Content-Type': 'text/html; charset=utf-8' } }
    );
  }
}

/* ---------- MESSAGE: permite forçar update do SW ---------- */
self.addEventListener('message', event => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
  if (event.data && event.data.type === 'GET_VERSION') {
    event.ports[0].postMessage({ version: SW_VERSION });
  }
});
