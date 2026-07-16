const CACHE = "dobre-jedzenie-v21";
const APP_ROOT = "/Dobre-jedzenie/";
const APP_SHELL = `${APP_ROOT}index.html`;

const ASSETS = [
  APP_ROOT,
  APP_SHELL,
  `${APP_ROOT}styles.css?v=21`,
  `${APP_ROOT}recipes.js?v=21`,
  `${APP_ROOT}app.js?v=21`,
  `${APP_ROOT}manifest.webmanifest?v=21`,
  `${APP_ROOT}icon-192.png`,
  `${APP_ROOT}icon-512.png`
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE).then((cache) => cache.addAll(ASSETS))
  );
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((key) => key !== CACHE).map((key) => caches.delete(key)))
    )
  );
  self.clients.claim();
});

self.addEventListener("fetch", (event) => {
  if (event.request.method !== "GET") return;

  const requestUrl = new URL(event.request.url);

  if (event.request.mode === "navigate" && requestUrl.pathname.startsWith(APP_ROOT)) {
    event.respondWith(
      fetch(event.request).catch(() => caches.match(APP_SHELL))
    );
    return;
  }

  if (requestUrl.origin !== self.location.origin) return;

  event.respondWith(
    caches.match(event.request).then((cached) => {
      const network = fetch(event.request)
        .then((response) => {
          if (response.ok) {
            const copy = response.clone();
            caches.open(CACHE).then((cache) => cache.put(event.request, copy));
          }
          return response;
        })
        .catch(() => cached);

      return cached || network;
    })
  );
});
