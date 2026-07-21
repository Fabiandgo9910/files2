// sw.js
// Service Worker de "La Pizarra". Su único trabajo es permitir que la
// app se pueda INSTALAR (requisito técnico de las PWA) y que la
// interfaz cargue rápido / offline. Los datos (notas) SIEMPRE se piden
// en vivo al servidor: nunca cacheamos /api/notes, para no mostrar
// nunca notas desactualizadas.

const CACHE_NAME = 'pizarra-shell-v1'; // sube el número si cambias los archivos cacheados

const APP_SHELL = [
  '/',
  '/index.html',
  '/manifest.json',
  '/icons/icon-192.png',
  '/icons/icon-512.png',
  '/icons/icon-maskable-512.png',
];

// --- Instalación: precachea el "esqueleto" de la app ---------------------
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(APP_SHELL))
  );
  self.skipWaiting();
});

// --- Activación: limpia cachés de versiones antiguas ---------------------
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key))
      )
    )
  );
  self.clients.claim();
});

// --- Estrategia de red ----------------------------------------------------
self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);

  // Las llamadas a la API NUNCA se cachean: siempre red, siempre datos frescos.
  if (url.pathname.startsWith('/api/')) {
    event.respondWith(fetch(event.request));
    return;
  }

  // El resto (HTML, CSS/JS embebidos, iconos): cache-first con
  // actualización en segundo plano, para carga instantánea y offline.
  event.respondWith(
    caches.match(event.request).then((cached) => {
      const networkFetch = fetch(event.request)
        .then((response) => {
          if (response.ok) {
            const clone = response.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone));
          }
          return response;
        })
        .catch(() => cached); // sin red: usa lo que haya en caché

      return cached || networkFetch;
    })
  );
});

// --- Recepción de una notificación push real desde el servidor -----------
// Esto es lo que permite que el aviso llegue aunque la app esté cerrada:
// el sistema operativo despierta este service worker solo para esto.
self.addEventListener('push', (event) => {
  let data = { title: '⏰ La Pizarra', body: 'Tienes un recordatorio pendiente.' };
  try {
    if (event.data) data = event.data.json();
  } catch (e) {
    if (event.data) data.body = event.data.text();
  }

  const options = {
    body: data.body,
    icon: '/icons/icon-192.png',
    badge: '/icons/icon-192.png',
    vibrate: [200, 100, 200],
    data: { url: '/' },
  };

  event.waitUntil(self.registration.showNotification(data.title, options));
});

// --- Al tocar la notificación: abre (o enfoca) la app ---------------------
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      for (const client of clientList) {
        if (client.url.includes(self.location.origin) && 'focus' in client) return client.focus();
      }
      if (clients.openWindow) return clients.openWindow('/');
    })
  );
});
