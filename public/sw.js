// Bump this on every deploy that changes app behavior. Changing the
// string forces the browser to see sw.js as "different" and install +
// activate a fresh service worker, which is the only reliable way to
// stop it from serving a stale cached index.html/app shell.
const CACHE_NAME = "nimir-v3";

const urlsToCache = [
  "/manifest.json",
  "/favicon.ico",
  "/logo192.png",
  "/logo512.png",
];

// Requests to your API should NEVER be served from cache or answered
// with a cached HTML fallback — that was silently corrupting sync
// responses (a failed API call would resolve with index.html instead
// of a real network error, then sync.js would try to .json() an HTML
// page). Set this to your actual backend origin.
const API_ORIGIN = "https://nimir-stress-managing-todo.onrender.com";

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(urlsToCache))
  );
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) =>
      Promise.all(
        cacheNames
          .filter((name) => name !== CACHE_NAME)
          .map((name) => caches.delete(name))
      )
    )
  );
  self.clients.claim();
});

self.addEventListener("fetch", (event) => {
  const url = new URL(event.request.url);

  // 1. Never touch API requests — always go straight to the network,
  //    and let a real failure be a real failure (no HTML masquerading
  //    as a JSON response).
  if (url.origin === API_ORIGIN) {
    return; // let the browser handle it normally, untouched by the SW
  }

  // 2. Navigation requests (loading the app shell itself) — always
  //    try the network FIRST so you get the latest deployed build,
  //    only falling back to cache if truly offline. This is what
  //    stops you from getting stuck on an old cached index.html.
  if (event.request.mode === "navigate") {
    event.respondWith(
      fetch(event.request).catch(() => caches.match("/"))
    );
    return;
  }

  // 3. Static assets (icons, manifest) — cache-first is fine here,
  //    these rarely change and aren't where staleness matters.
  event.respondWith(
    caches.match(event.request).then((cached) => {
      if (cached) return cached;
      return fetch(event.request).catch(() => cached);
    })
  );
});