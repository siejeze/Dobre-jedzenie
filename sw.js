const CACHE = "dobre-jedzenie-v19";
const ASSETS = [
  "./",
  "./index.html",
  "./styles.css?v=18",
  "./recipes.js?v=18",
  "./app.js?v=18",
  "./native-install.js?v=19",
  "./manifest.webmanifest",
  "./icons/icon-192-v14.png",
  "./icons/icon-512-v14.png"
];

self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(CACHE).then((cache) => cache.addAll(ASSETS)));
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

async function addNativeInstallBehaviour(response) {
  const contentType = response.headers.get("content-type") || "";
  if (!contentType.includes("text/html")) return response;

  const html = await response.text();
  const updatedHtml = html.includes("native-install.js")
    ? html
    : html.replace("</head>", "  <script src=\"./native-install.js?v=19\"></script>\n</head>");

  return new Response(updatedHtml, {
    status: response.status,
    statusText: response.statusText,
    headers: response.headers
  });
}

self.addEventListener("fetch", (event) => {
  if (event.request.method !== "GET") return;

  event.respondWith(
    fetch(event.request)
      .then(async (response) => {
        const copy = response.clone();
        caches.open(CACHE).then((cache) => cache.put(event.request, copy));

        if (event.request.mode === "navigate") {
          return addNativeInstallBehaviour(response);
        }
        return response;
      })
      .catch(async () => {
        const cached = await caches.match(event.request) || await caches.match("./index.html");
        if (event.request.mode === "navigate" && cached) {
          return addNativeInstallBehaviour(cached);
        }
        return cached;
      })
  );
});
