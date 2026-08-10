const CACHE_NAME = "worthtrace-mobile-pwa-0.3.34";
const ASSETS = [
  "./",
  "./index.html",
  "./styles.css",
  "./app.js",
  "./manifest.webmanifest",
  "./logo-qianji-a.svg"
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(ASSETS))
  );
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) => Promise.all(
      keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key))
    ))
  );
  self.clients.claim();
});

self.addEventListener("fetch", (event) => {
  if (event.request.method !== "GET") return;
  const isNavigation = event.request.mode === "navigate";
  event.respondWith(
    fetch(event.request)
      .then((response) => {
        const copy = response.clone();
        caches.open(CACHE_NAME).then((cache) => cache.put(event.request, copy));
        return response;
      })
      .catch(async () => {
        // The mobile link carries syncUrl/pairCode query parameters. They must
        // not prevent the cached app shell from being used offline.
        const cached = await caches.match(event.request, { ignoreSearch: true });
        if (cached) return cached;
        if (isNavigation) {
          return caches.match("./index.html", { ignoreSearch: true });
        }
        return undefined;
      })
  );
});
