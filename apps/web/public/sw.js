// tsukutta: 最小限のオフライン対応。
// APIリクエスト(別オリジンのWorkers)は横取りせず、同一オリジンの静的アセット/ページのみを
// network-first + キャッシュフォールバックで扱う。認証済みJSONのキャッシュは行わない。
const CACHE_NAME = "tsukutta-shell-v1";
const OFFLINE_URL = "/offline.html";

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll([OFFLINE_URL])),
  );
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k))),
      ),
  );
  self.clients.claim();
});

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;

  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return; // API(別オリジン)は素通し
  if (url.pathname.startsWith("/api/")) return;

  if (req.mode === "navigate") {
    event.respondWith(
      fetch(req)
        .then((res) => {
          const copy = res.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(req, copy));
          return res;
        })
        .catch(
          () => caches.match(req).then((cached) => cached ?? caches.match(OFFLINE_URL)),
        ),
    );
    return;
  }

  event.respondWith(
    caches.match(req).then(
      (cached) =>
        cached ??
        fetch(req).then((res) => {
          const copy = res.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(req, copy));
          return res;
        }),
    ),
  );
});
