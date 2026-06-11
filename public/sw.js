// Service Worker — cache do bundle Expo + assets estaticos.
// Network-only pra APIs (FastAPI, Anthropic, ElevenLabs, AssemblyAI).
//
// Estrategia:
//   - GETs com hash imutaveis (_expo/static/*): cache-first, cache forever
//   - HTML/JS root: network-first com fallback cache (revalidate)
//   - APIs: nao intercepta, browser faz network normal
//   - POST/PUT/DELETE: nao intercepta

const CACHE_VERSION = "dlibras-v3";
const STATIC_ASSETS = [
  "/",
  "/manifest.webmanifest",
  "/icons/icon-192.png",
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_VERSION).then((cache) =>
      cache.addAll(STATIC_ASSETS).catch(() => {
        // Falha de pre-cache nao deve impedir SW de instalar.
      }),
    ),
  );
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys
          .filter((k) => k !== CACHE_VERSION)
          .map((k) => caches.delete(k)),
      ),
    ),
  );
  self.clients.claim();
});

function isApiRequest(url) {
  return (
    url.pathname.startsWith("/dlibras-api/") ||
    url.pathname.startsWith("/predict") ||
    url.pathname.startsWith("/api/") ||
    url.pathname.startsWith("/health") ||
    url.hostname.includes("anthropic.com") ||
    url.hostname.includes("elevenlabs.io") ||
    url.hostname.includes("assemblyai.com") ||
    url.hostname.includes("trycloudflare.com") ||
    url.port === "8001" ||
    url.port === "8801"
  );
}

function isImmutableAsset(url) {
  return (
    url.pathname.startsWith("/_expo/static/") ||
    url.pathname.startsWith("/assets/") ||
    url.pathname.startsWith("/icons/")
  );
}

self.addEventListener("fetch", (event) => {
  const { request } = event;

  // Pula nao-GETs (POST/PUT/DELETE/PATCH)
  if (request.method !== "GET") return;

  let url;
  try {
    url = new URL(request.url);
  } catch {
    return;
  }

  // Pula APIs (deixa browser cuidar)
  if (isApiRequest(url)) return;

  // Pula schemes nao-http (chrome-extension, data:, etc)
  if (!url.protocol.startsWith("http")) return;

  // Estrategia 1: imutaveis -> cache-first
  if (isImmutableAsset(url)) {
    event.respondWith(
      caches.open(CACHE_VERSION).then(async (cache) => {
        const cached = await cache.match(request);
        if (cached) return cached;
        try {
          const fresh = await fetch(request);
          if (fresh && fresh.ok) {
            cache.put(request, fresh.clone()).catch(() => {});
          }
          return fresh || new Response("", { status: 504 });
        } catch (err) {
          return new Response("", { status: 504, statusText: "Offline" });
        }
      }),
    );
    return;
  }

  // Estrategia 2: HTML/CSS/JS root -> network-first, fallback cache
  event.respondWith(
    (async () => {
      try {
        const fresh = await fetch(request);
        if (fresh && fresh.ok) {
          const cache = await caches.open(CACHE_VERSION);
          cache.put(request, fresh.clone()).catch(() => {});
          return fresh;
        }
        // Resposta nao-ok ainda eh uma Response valida — retorna ela
        return fresh || new Response("", { status: 504 });
      } catch (err) {
        // Network falhou (offline) — tenta cache
        const cached = await caches.match(request);
        if (cached) return cached;
        // Fallback final: home page do cache
        if (request.mode === "navigate") {
          const home = await caches.match("/");
          if (home) return home;
        }
        // Sempre retornar uma Response valida (nunca undefined)
        return new Response(
          "<h1>Offline</h1><p>Sem conexao e sem cache.</p>",
          {
            status: 503,
            statusText: "Service Unavailable",
            headers: { "Content-Type": "text/html; charset=utf-8" },
          },
        );
      }
    })(),
  );
});
