importScripts("https://cdn.onesignal.com/sdks/web/v16/OneSignalSDK.sw.js");

const CACHE = "aurikrex-bytes-v6";
const SHELL = ["/", "/manifest.webmanifest"];

self.addEventListener("install", event => {
  event.waitUntil(caches.open(CACHE).then(cache => cache.addAll(SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener("activate", event => {
  event.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(key => key !== CACHE).map(key => caches.delete(key)))).then(() => self.clients.claim()));
});

self.addEventListener("fetch", event => {
  const request = event.request;
  if (request.method !== "GET" || request.url.includes("/api/") || request.url.includes("/manus-storage/")) return;

  if (request.mode === "navigate") {
    event.respondWith(fetch(request).then(response => {
      const copy = response.clone();
      caches.open(CACHE).then(cache => cache.put(request, copy));
      return response;
    }).catch(() => caches.match(request).then(cached => cached || caches.match("/"))));
    return;
  }

  event.respondWith(caches.match(request).then(cached => cached || fetch(request).then(response => {
    if (response.ok && new URL(request.url).origin === self.location.origin) {
      const copy = response.clone();
      caches.open(CACHE).then(cache => cache.put(request, copy));
    }
    return response;
  }).catch(() => caches.match("/"))));
});

// Note: Generic self.addEventListener("push") has been removed.
// OneSignalSDK.sw.js handles push event rendering with the rich custom payload.

self.addEventListener("notificationclick", event => {
  event.notification.close();
  const notifData = event.notification.data || {};
  let targetUrl = notifData.url || "/";
  if (event.action === "all-bytes") {
    targetUrl = "/";
  } else if (event.action === "read-now") {
    targetUrl = notifData.url || "/";
  }

  const urlToOpen = new URL(targetUrl, self.location.origin).href;

  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then(windowClients => {
      // Find an existing window from the same origin (not exact URL)
      for (let i = 0; i < windowClients.length; i++) {
        const windowClient = windowClients[i];
        try {
          if (new URL(windowClient.url).origin === self.location.origin) {
            if ("navigate" in windowClient && typeof windowClient.navigate === "function") {
              return windowClient.navigate(urlToOpen).then(client => (client ? client.focus() : windowClient.focus()));
            }
            return windowClient.focus();
          }
        } catch {}
      }
      if (self.clients.openWindow) {
        return self.clients.openWindow(urlToOpen);
      }
    })
  );
});
