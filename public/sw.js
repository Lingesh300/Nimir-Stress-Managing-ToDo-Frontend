// public/sw.js
const CACHE_NAME = "nimir-cache-v1";
const ASSETS_TO_CACHE = [
  "/",
  "/index.html",
  "/favicon.ico",
  "/manifest.json" // Make sure you have a manifest file for PWA installation!
];

// 1. Install Event - Cache essential shell files for true offline loading
self.addEventListener("install", (event) => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(ASSETS_TO_CACHE);
    })
  );
});

// 2. Activate Event - Claim control of all open client tabs instantly
self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim());
});

// 3. Fetch Event - Network fallback to local cache strategy so app runs offline
self.addEventListener("fetch", (event) => {
  if (event.request.method !== "GET") return;
  
  event.respondWith(
    fetch(event.request)
      .then((response) => {
        return response;
      })
      .catch(() => {
        return caches.match(event.request);
      })
  );
});

// 4. Native OS Alarm Event Listener (THE MOBILE OFFLINE FIX)
self.addEventListener("message", (event) => {
  if (event.data && event.data.type === "SCHEDULE_REMINDER") {
    const { title, body, delay, tag } = event.data;

    // Use a native browser execution timer that hooks into the OS background thread
    setTimeout(() => {
      self.registration.showNotification(title, {
        body: body,
        icon: "/favicon.ico",
        badge: "/favicon.ico",
        tag: tag, // Prevents duplicate spamming
        requireInteraction: true,
        vibrate: [200, 100, 200] // Native haptic vibration alert for mobile devices!
      });
    }, delay);
  }
});