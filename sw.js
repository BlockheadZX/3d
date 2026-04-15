const CACHE = "harvest-orchard-v46"

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
async function precacheOne (scope, cache, path) {
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

function isScriptPath (path) {
  return /\.(js|mjs)$/i.test(path);
}

function cachedScriptLooksPoisoned (response) {
  if (!response) return false;
  const ct = (response.headers.get("content-type") || "").toLowerCase();
  return ct.includes("text/html");
}

/** Same URL without ?query so precached bare paths still match offline. */
function urlWithoutSearch (requestUrl) {
  const u = new URL(requestUrl);
  u.search = "";
  return u.toString();
}

function usesNetworkFirst (path) {
  return isScriptPath(path) || /\.css$/i.test(path);
}

/**
 * JS / CSS: network first so deploys pick up new file-bundle.js & styles.css
 * without relying only on CACHE bumps; fall back to precache when offline.
 */
async function networkFirstScript (event) {
  try {
    /* reload: 绕过浏览器 HTTP 缓存，否则 SW 已网络优先仍可能拿到旧 styles.css / JS */
    const res = await fetch(event.request, { cache: "reload" });
    if (res.ok) {
      const ct = (res.headers.get("content-type") || "").toLowerCase();
      if (!ct.includes("text/html")) {
        const cache = await caches.open(CACHE);
        await cache.put(event.request, res.clone());
        return res;
      }
    }
  } catch (_) {
    // offline or network error — use cache below
  }

  let cached = await caches.match(event.request);
  if (cached && !cachedScriptLooksPoisoned(cached)) return cached;
  cached = await caches.match(urlWithoutSearch(event.request.url));
  if (cached && !cachedScriptLooksPoisoned(cached)) return cached;

  try {
    return await fetch(event.request, { cache: "reload" });
  } catch {
    return cached || new Response("", { status: 503, statusText: "Offline" });
  }
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

  const path = url.pathname;
  if (usesNetworkFirst(path)) {
    event.respondWith(networkFirstScript(event));
    return;
  }

  event.respondWith(
    (async () => {
      const cached = await caches.match(event.request);
      if (cached) return cached;
      return fetch(event.request);
    })()
  );
});
