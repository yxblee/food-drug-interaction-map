// Offline cache. Hand-written, no dependency. Registered only in production builds (src/offline.ts).
// The page registers `sw.js?v=<build id>`: a new build is a new URL, so a new worker, a new cache,
// and activate deletes the old ones. Only same-origin GETs are cached: app shell, scripts and the
// static Dataset JSON. The Medication list lives in browser storage and is never requested, so it
// can never reach a cache.
const CACHE = `fdi-${new URL(self.location.href).searchParams.get('v')}`
const SCOPE = self.registration.scope
const SLOW_MS = 4000

self.addEventListener('install', () => self.skipWaiting())

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((names) => Promise.all(names.filter((n) => n !== CACHE).map((n) => caches.delete(n))))
      .then(() => self.clients.claim()),
  )
})

// Responses from the cache carry this header, so the page can say it shows saved data.
const saved = (res) => {
  const headers = new Headers(res.headers)
  headers.set('x-fdi-saved', '1')
  return new Response(res.body, { status: res.status, statusText: res.statusText, headers })
}

// Network first, so a new deploy replaces old data on the next online visit. Offline, or when the
// network is slower than SLOW_MS and a copy exists, the saved copy answers.
self.addEventListener('fetch', (event) => {
  const { request } = event
  const url = new URL(request.url)
  if (request.method !== 'GET' || url.origin !== self.location.origin) return
  // Every URL state (?tab=meds ...) is the same page.
  const key = request.mode === 'navigate' ? SCOPE : request
  event.respondWith(
    (async () => {
      const cache = await caches.open(CACHE)
      const network = fetch(request).then((res) => {
        if (res.ok) void cache.put(key, res.clone()).catch(() => {})
        return res
      })
      network.catch(() => {}) // the race below may already have answered from the copy
      const copy = () => cache.match(key, { ignoreVary: true }).then((hit) => hit && saved(hit))
      const slow = new Promise((resolve) => setTimeout(() => resolve(copy()), SLOW_MS))
      try {
        return (await Promise.race([network, slow])) ?? (await network)
      } catch {
        return (await copy()) ?? Response.error()
      }
    })(),
  )
})

// The page lists what it loaded (and every node file) so the first visit is complete offline.
self.addEventListener('message', (event) => {
  if (event.data?.type !== 'save') return
  event.waitUntil(
    caches.open(CACHE).then((cache) =>
      Promise.all(
        event.data.urls.map(async (u) => {
          const url = new URL(u, SCOPE)
          if (url.origin !== self.location.origin || (await cache.match(url))) return
          try {
            const res = await fetch(url)
            if (res.ok) await cache.put(url, res)
          } catch {}
        }),
      ),
    ),
  )
})
