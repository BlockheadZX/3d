const CACHE = "harvest-orchard-v16";

const PRECACHE_URLS = [
  "index.html",
  "main-enhanced.js",
  "styles.css",
  "file-bundle.js",
  "manifest.webmanifest",
  "icons/app-icon.png",
  "vendor/three/build/three.module.js",
  "vendor/three/examples/jsm/controls/OrbitControls.js",
];

self.addEventListener("install", (event) => {
  const scope = self.registration.scope;
  event.waitUntil(
    caches
      .open(CACHE)
      .then((cache) =>
        Promise.all(
          PRECACHE_URLS.map((path) => precacheOne(scope, cache, path))
        )
      )
      .then(() => self.skipWaiting())
  );
});

/**
 * Some static hosts apply SPA fallback so *.js URLs return index.html (200 + text/html).
 * cache.add() would store that HTML and break ES module loads — validate before caching.
 */
async function precacheOne(scope, cache, path) {
  const url = new URL(path, scope).toString();
  try {
    const res = await fetch(url, { cache: "reload" });
    if (!res.ok) return;
    const ct = (res.headers.get("content-type") || "").toLowerCase();
    if (isScriptPath(path) && ct.includes("text/html")) {
      console.warn("[SW] skip precache (got HTML instead of script):", path);
      return;
    }
    await cache.put(url, res.clone());
  } catch {
    // offline or missing file during install
  }
}

function isScriptPath(path) {
  return /\.(js|mjs)$/i.test(path);
}

function cachedScriptLooksPoisoned(response) {
  if (!response) return false;
  const ct = (response.headers.get("content-type") || "").toLowerCase();
  return ct.includes("text/html");
}

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys.filter((key) => key !== CACHE).map((key) => caches.delete(key))
        )
      )
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (event) => {
  if (event.request.method !== "GET") return;
  const url = new URL(event.request.url);
  if (url.origin !== location.origin) return;

  if (event.request.mode === "navigate") {
    event.respondWith(
      fetch(event.request).catch(() =>
        caches.match(new URL("index.html", self.registration.scope).toString())
      )
    );
    return;
  }

  event.respondWith(
    (async () => {
      const cached = await caches.match(event.request);
      const path = url.pathname;
      if (
        cached &&
        isScriptPath(path) &&
        cachedScriptLooksPoisoned(cached)
      ) {
        const cache = await caches.open(CACHE);
        await cache.delete(event.request);
        return fetch(event.request);
      }
      if (cached) return cached;
      return fetch(event.request);
    })()
  );
});
