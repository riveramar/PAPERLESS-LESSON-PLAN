/* TNHS Lesson Plan Portal — service worker
   Purpose: makes the site installable and a little faster to open.
   - Only handles same-origin requests (the site's own files).
   - NEVER touches Google Drive / Google Sign-In / the AI proxy — those always go straight to the network,
     so lesson plans, sign-in and the Tracker are always live data.
   - The page itself (index.html) is "network first": when online you always get the newest version after
     a deploy; the cached copy is only a fallback when offline.
   Bump CACHE_VERSION whenever you change the list of files below. */
const CACHE_VERSION = 'tnhs-portal-v1';
const APP_SHELL = ['./', './index.html', './manifest.webmanifest', './icon-192.png', './icon-512.png'];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_VERSION)
      .then((cache) => cache.addAll(APP_SHELL))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE_VERSION).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return; // Google APIs, fonts, proxy → network, untouched

  // Page loads: network first, cache as offline fallback
  if (req.mode === 'navigate') {
    event.respondWith(
      fetch(req)
        .then((res) => {
          const copy = res.clone();
          caches.open(CACHE_VERSION).then((c) => c.put('./index.html', copy)).catch(() => {});
          return res;
        })
        .catch(() => caches.match('./index.html').then((hit) => hit || caches.match('./')))
    );
    return;
  }

  // Other same-origin files (icons, manifest): cache first, refresh in background
  event.respondWith(
    caches.match(req).then((hit) => {
      const refresh = fetch(req)
        .then((res) => {
          if (res && res.ok) { const copy = res.clone(); caches.open(CACHE_VERSION).then((c) => c.put(req, copy)).catch(() => {}); }
          return res;
        })
        .catch(() => hit);
      return hit || refresh;
    })
  );
});
