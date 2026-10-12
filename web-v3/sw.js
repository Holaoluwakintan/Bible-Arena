/* Bible Arena service-worker kill switch (rollback of v3.2.0).
 * Replaces any installed v3.2.0 worker, deletes its caches, unregisters itself
 * and reloads open pages so they come straight from the server again. */
self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (event) => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.filter((k) => k.startsWith("ba-")).map((k) => caches.delete(k)));
    await self.registration.unregister();
    const clients = await self.clients.matchAll({ type: "window" });
    clients.forEach((c) => { try { c.navigate(c.url); } catch (e) {} });
  })());
});
