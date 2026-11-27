const CACHE = 'floorplan-shell-443d4e807096'
const BASE = new URL(self.registration.scope).pathname
const SHELL = [
  BASE,
  `${BASE}index.html`,
  `${BASE}manifest.webmanifest`,
  `${BASE}icons/icon-192.png`,
  `${BASE}icons/icon-512.png`,
]

async function precache() {
  const cache = await caches.open(CACHE)
  await cache.addAll(SHELL)
  const response = await fetch(`${BASE}index.html`, { cache: 'no-store' })
  if (response.ok) {
    const html = await response.text()
    await cache.put(
      `${BASE}index.html`,
      new Response(html, { headers: { 'Content-Type': 'text/html; charset=utf-8' } }),
    )
    const assets = [...html.matchAll(/(?:src|href)="(\/[^"]+\.(?:js|css))"/g)].map(
      (match) => match[1],
    )
    await cache.addAll([...new Set(assets)])
  }
  const manifest = await fetch(`${BASE}precache-manifest.json`, { cache: 'no-store' })
  if (manifest.ok) {
    await cache.put(`${BASE}precache-manifest.json`, manifest.clone())
    const data = await manifest.json()
    if (Array.isArray(data.files)) await cache.addAll(data.files)
  }
}

self.addEventListener('install', (event) => {
  event.waitUntil(precache())
})

self.addEventListener('message', (event) => {
  if (event.data === 'SKIP_WAITING' || event.data?.type === 'SKIP_WAITING') {
    self.skipWaiting()
  }
})

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((key) => key !== CACHE).map((key) => caches.delete(key))))
      .then(() => self.clients.claim()),
  )
})

async function navigationResponse(request) {
  try {
    const response = await fetch(request)
    if (response.ok) {
      const copy = response.clone()
      caches.open(CACHE).then((cache) => cache.put(`${BASE}index.html`, copy))
    }
    return response
  } catch {
    return (
      (await caches.match(request)) ||
      (await caches.match(`${BASE}index.html`)) ||
      (await caches.match(BASE)) ||
      Response.error()
    )
  }
}

async function assetResponse(request) {
  const cached = await caches.match(request)
  const network = fetch(request)
    .then((response) => {
      if (response.ok) {
        const copy = response.clone()
        caches.open(CACHE).then((cache) => cache.put(request, copy))
      }
      return response
    })
    .catch(() => cached)
  return cached || network
}

self.addEventListener('fetch', (event) => {
  const request = event.request
  if (request.method !== 'GET') return
  const url = new URL(request.url)
  if (url.origin !== self.location.origin) return
  if (request.mode === 'navigate') {
    event.respondWith(navigationResponse(request))
    return
  }
  event.respondWith(assetResponse(request))
})