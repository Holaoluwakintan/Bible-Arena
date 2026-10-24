/* Bible Arena service worker (v3.10.0).
 * - Opens instantly on repeat visits, even while the free server is waking up:
 *   the home page is served from the saved copy at once and refreshed in the background;
 *   duel links (/d/...) try the network for 3 s, then fall back to the last saved copy.
 * - Game files (/v3/...) are served from the cache and refreshed in the background.
 * - API calls, sign-in, downloads and legal pages always go to the network.
 * - Web Push (v3.5.0): shows "a challenger is waiting" notifications; a tap opens (or focuses) the game at the challenge.
 */
const VERSION = "ba-3.10.0";
const SHELL = "/";
const PRECACHE = [
  "/",
  "/v3/app.css?v=3.10.0",
  "/v3/app.js?v=3.10.0",
  "/v3/social.js?v=3.10.0",
  "/v3/bank.json?v=3.10.0",
  "/v3/fonts/cinzel-latin.woff2",
  "/v3/fonts/jakarta-latin.woff2",
  "/v3/icon-192.png",
  "/v3/manifest.webmanifest",
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(VERSION).then((c) => Promise.all(PRECACHE.map((u) => c.add(new Request(u, { cache: "reload" })).catch(() => {}))))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.filter((k) => k.startsWith("ba-") && k !== VERSION).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

const NETWORK_ONLY = /^\/(api|download|app$|android$|\.well-known|privacy|delete-account|sw\.js)/;

function timeout(ms) { return new Promise((resolve) => setTimeout(resolve, ms)); }

async function pageRequest(event) {
  const req = event.request;
  const cache = await caches.open(VERSION);
  const network = fetch(req).then((res) => {
    if (res && res.ok && res.type === "basic") {
      const url = new URL(req.url);
      // Keep one copy of the app shell (the home page) for offline and slow starts.
      if (url.pathname === "/") cache.put(SHELL, res.clone());
    }
    return res;
  });
  event.waitUntil(network.catch(() => {}));
  const winner = await Promise.race([network.catch(() => null), timeout(3000).then(() => null)]);
  if (winner) return winner;
  const cached = (await cache.match(req, { ignoreSearch: true })) || (await cache.match(SHELL));
  if (cached) return cached;
  return network; // nothing saved yet: wait for the server as before
}

// Home page: paints from the saved copy at once (the loading screen and the game files are in it),
// and the fresh page is fetched in the background for next time. First visit (nothing saved): network as before.
async function shellFirst(event) {
  const cache = await caches.open(VERSION);
  const cached = await cache.match(SHELL);
  if (!cached) return pageRequest(event);
  const refresh = fetch(event.request).then((res) => {
    if (res && res.ok && res.type === "basic") cache.put(SHELL, res.clone());
    return res;
  });
  event.waitUntil(refresh.catch(() => {}));
  return cached;
}

async function staticRequest(event) {
  const cache = await caches.open(VERSION);
  const cached = await cache.match(event.request);
  const refresh = fetch(event.request).then((res) => {
    if (res && res.ok) cache.put(event.request, res.clone());
    return res;
  });
  if (cached) { event.waitUntil(refresh.catch(() => {})); return cached; }
  return refresh;
}

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;
  if (NETWORK_ONLY.test(url.pathname)) return;
  // Only the v3 game pages use the shell fallback; the classic app and Live keep their own behaviour.
  if (req.mode === "navigate") {
    if (url.pathname === "/" || url.pathname === "/index.html") event.respondWith(shellFirst(event));
    else if (url.pathname.startsWith("/d/")) event.respondWith(pageRequest(event));
    return;
  }
  if (url.pathname.startsWith("/v3/")) event.respondWith(staticRequest(event));
});

// ---------- Web Push (v3.5.0) ----------
self.addEventListener("push", (event) => {
  let d = {};
  try { d = event.data ? event.data.json() : {}; } catch (e) { d = { body: event.data ? event.data.text() : "" }; }
  const title = d.title || "Bible Arena";
  event.waitUntil(self.registration.showNotification(title, {
    body: d.body || "Someone is waiting for a challenger. Tap to join!",
    icon: "/v3/icon-192.png", badge: "/v3/icon-192.png", tag: d.tag || "ba", renotify: true,
    data: { url: typeof d.url === "string" && d.url.startsWith("/") ? d.url : "/#/live" },
  }));
});
self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url = new URL((event.notification.data && event.notification.data.url) || "/#/live", self.location.origin).href;
  event.waitUntil((async () => {
    const all = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
    for (const c of all) {
      if (new URL(c.url).origin === self.location.origin && "focus" in c) {
        try { await c.navigate(url); } catch (e) {}
        return c.focus();
      }
    }
    return self.clients.openWindow(url);
  })());
});
