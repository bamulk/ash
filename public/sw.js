// Ashley Stone Homes service worker.
//
// Strategy:
//   navigations → network-first, fall back to /offline.html when offline
//   same-origin static assets (icons, images, fonts) → cache-first
//   everything else → pass-through to network (HTML/JSON pages live behind
//     auth and shouldn't be cached aggressively)
//
// Bump CACHE_VERSION when shipping a change to this file or the offline
// page; that invalidates the prior cache on activate.

const CACHE_VERSION = "v1";
const STATIC_CACHE = `ash-static-${CACHE_VERSION}`;
const OFFLINE_URL = "/offline.html";

const PRECACHE = [
  OFFLINE_URL,
  "/icon-192.png",
  "/icon-512.png",
  "/favicon.ico",
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(STATIC_CACHE)
      .then((cache) => cache.addAll(PRECACHE))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys
            .filter((k) => k !== STATIC_CACHE)
            .map((k) => caches.delete(k))
        )
      )
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") return;

  // Navigation requests — network first, offline fallback.
  if (request.mode === "navigate") {
    event.respondWith(
      (async () => {
        try {
          return await fetch(request);
        } catch {
          const cache = await caches.open(STATIC_CACHE);
          return (
            (await cache.match(OFFLINE_URL)) ||
            new Response("Offline", { status: 503 })
          );
        }
      })()
    );
    return;
  }

  // Same-origin static asset — cache first, update in background.
  const url = new URL(request.url);
  const sameOrigin = url.origin === self.location.origin;
  const isStatic = /\.(?:png|jpg|jpeg|svg|webp|ico|woff2?|css|js)$/i.test(
    url.pathname
  );

  if (sameOrigin && isStatic) {
    event.respondWith(
      caches.open(STATIC_CACHE).then((cache) =>
        cache.match(request).then((cached) => {
          const network = fetch(request)
            .then((res) => {
              if (res.ok) cache.put(request, res.clone());
              return res;
            })
            .catch(() => cached);
          return cached || network;
        })
      )
    );
  }
});
