/**
 * Service worker de Brasa: funcionamiento sin conexión + clic en notificaciones.
 *
 * Estrategias:
 * - Archivos propios → "network first": siempre la versión más nueva si hay red,
 *   y la copia en caché si no la hay (evita servir código viejo durante el desarrollo).
 * - Fuentes de Google y SDK de Supabase (URL con versión fija) → "cache first": no cambian.
 * - La API de Supabase no se intercepta (siempre va a la red).
 *
 * Al añadir archivos a src/ o styles/, agrégalos a PRECACHE (un test lo verifica).
 */
const CACHE = 'brasa-v3';
const FONT_CACHE = 'brasa-fonts-v1';
const STATIC_HOSTS = ['fonts.googleapis.com', 'fonts.gstatic.com', 'cdn.jsdelivr.net'];

const PRECACHE = [
  './',
  './index.html',
  './manifest.webmanifest',
  './assets/icons/brasa.svg',
  './styles/tokens.css',
  './styles/base.css',
  './styles/components.css',
  './styles/views.css',
  './src/main.js',
  './src/config.js',
  './src/core/dom.js',
  './src/core/feedback.js',
  './src/core/reminders.js',
  './src/core/router.js',
  './src/core/store.js',
  './src/core/supabase.js',
  './src/core/sync.js',
  './src/components/ember.js',
  './src/components/figure.js',
  './src/data/exercises.js',
  './src/data/options.js',
  './src/data/workout-types.js',
  './src/domain/dates.js',
  './src/domain/ember.js',
  './src/domain/merge.js',
  './src/domain/random.js',
  './src/domain/reminder.js',
  './src/domain/streak.js',
  './src/domain/timer.js',
  './src/domain/workout.js',
  './src/views/account.js',
  './src/views/home.js',
  './src/views/onboarding.js',
  './src/views/profile.js',
  './src/views/progress.js',
  './src/views/workout.js',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(CACHE)
      .then((cache) => cache.addAll(PRECACHE))
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener('activate', (event) => {
  const keep = new Set([CACHE, FONT_CACHE]);
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((key) => !keep.has(key)).map((key) => caches.delete(key))))
      .then(() => self.clients.claim()),
  );
});

async function networkFirst(request) {
  const cache = await caches.open(CACHE);
  try {
    const response = await fetch(request);
    if (response.ok) cache.put(request, response.clone());
    return response;
  } catch {
    const cached = await cache.match(request, { ignoreSearch: true });
    if (cached) return cached;
    if (request.mode === 'navigate') return cache.match('./index.html');
    return Response.error();
  }
}

async function cacheFirst(request) {
  const cache = await caches.open(FONT_CACHE);
  const cached = await cache.match(request);
  if (cached) return cached;
  const response = await fetch(request);
  if (response.ok || response.type === 'opaque') cache.put(request, response.clone());
  return response;
}

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;

  const url = new URL(request.url);
  if (url.origin === self.location.origin) {
    event.respondWith(networkFirst(request));
  } else if (STATIC_HOSTS.includes(url.hostname)) {
    event.respondWith(cacheFirst(request));
  }
});

/* Al tocar la notificación: enfocar Brasa si está abierta, o abrirla. */
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const target = new URL(event.notification.data?.url ?? './#/hoy', self.registration.scope).href;

  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((windows) => {
      const open = windows.find((client) => client.url.startsWith(self.registration.scope));
      return open ? open.focus() : self.clients.openWindow(target);
    }),
  );
});
