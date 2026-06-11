// Service Worker mínimo pra deixar a PWA "installable" no Lighthouse + cache
// dos assets estáticos pra modo offline básico (web).
//
// O conteúdo de lições/glossário já está em memória via JS bundle, então
// uma vez que o bundle carregou e ficou em cache aqui, o app abre offline.
//
// Estratégias:
//   - bundle / fonts / imagens → cache-first com revalidação em background
//   - /predict (API) → network-only (não cachear, sempre pega real-time)

const CACHE_VERSION = "dlibras-v1";
const STATIC_ASSETS = [
  "/",
  "/manifest.webmanifest",
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_VERSION).then((cache) => cache.addAll(STATIC_ASSETS)),
  );
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys.filter((k) => k !== CACHE_VERSION).map((k) => caches.delete(k)),
      ),
    ),
  );
  self.clients.claim();
});

self.addEventListener("fetch", (event) => {
  const url = new URL(event.request.url);

  // API requests — sempre rede, não cachear
  if (
    url.pathname.startsWith("/predict") ||
    url.hostname.includes("anthropic.com") ||
    url.hostname.includes("elevenlabs.io") ||
    url.hostname.includes("assemblyai.com") ||
    url.port === "8001"
  ) {
    return;
  }

  // Outros: cache-first com revalidate
  event.respondWith(
    caches.match(event.request).then((cached) => {
      const fetched = fetch(event.request)
        .then((response) => {
          // Só cacheia GETs OK
          if (event.request.method === "GET" && response && response.ok) {
            const clone = response.clone();
            caches.open(CACHE_VERSION).then((c) => c.put(event.request, clone));
          }
          return response;
        })
        .catch(() => cached);
      return cached || fetched;
    }),
  );
});
