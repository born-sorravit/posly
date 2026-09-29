/*
 * Posly service worker (plan §37). Deliberately small:
 *  - hashed build assets (/_next/static) are cached once, they never change under a URL;
 *  - a page that cannot load because the network is gone shows /offline.html;
 *  - nothing else is stored. Shop data, API responses and pages stay on the network, so a
 *    shared tablet never keeps one account's orders for the next person, and no one sells
 *    from yesterday's prices. Offline selling (§38) is a separate, explicit design.
 * Bump VERSION to retire old caches.
 */
const VERSION = "v2";
const CACHE = `posly-${VERSION}`;
// The offline page is self-contained (inline styles and logo): nothing else to fetch.
const PRECACHE = ["/offline.html"];

self.addEventListener("install", (event) => {
	event.waitUntil(caches.open(CACHE).then((cache) => cache.addAll(PRECACHE)));
	self.skipWaiting();
});

self.addEventListener("activate", (event) => {
	event.waitUntil(
		caches
			.keys()
			.then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
			.then(() => self.clients.claim())
	);
});

self.addEventListener("fetch", (event) => {
	const { request } = event;
	if (request.method !== "GET") return;
	const url = new URL(request.url);
	if (url.origin !== self.location.origin) return;

	if (url.pathname.startsWith("/_next/static/")) {
		event.respondWith(
			caches.open(CACHE).then(async (cache) => {
				const hit = await cache.match(request);
				if (hit) return hit;
				const response = await fetch(request);
				if (response.ok) cache.put(request, response.clone());
				return response;
			})
		);
		return;
	}

	if (request.mode === "navigate") {
		event.respondWith(
			fetch(request).catch(async () => (await caches.match("/offline.html")) ?? Response.error())
		);
	}
});
