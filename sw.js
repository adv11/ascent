// Ascent service worker (issue #19). Plain ES module — no build step, no
// Workbox, matching the rest of this app (CLAUDE.md). Registered as
// `{ type: 'module' }` from src/main.js so it can import the same pure
// cache-strategy functions the unit tests exercise.
//
// CACHE_VERSION must be bumped whenever a deploy changes static assets —
// mirrors ROADMAP_VERSION's "bump on incompatible change" convention in
// src/data/templates/java-backend.js. Bumping it busts every cache name
// below, so `activate` deletes the old ones on next load.
import { isFirebaseApiRequest, isRealtimeDbStreamingRequest, cacheFirst, networkFirst } from './src/services/sw/cacheStrategies.js';
import { findClientToFocus, getReminderTargetUrl } from './src/services/sw/notificationHelpers.js';

const CACHE_VERSION = 26;
const STATIC_CACHE = `ascent-static-v${CACHE_VERSION}`;
const DATA_CACHE = `ascent-data-v${CACHE_VERSION}`;
const OFFLINE_URL = '/public/offline.html';

// Precache the minimum needed to render *something* offline on a first
// visit with no other cache entries yet. Everything else (JS modules, other
// icons) is cached opportunistically the first time it's actually fetched,
// via the cache-first runtime strategy below.
const PRECACHE_URLS = [
  '/',
  '/index.html',
  OFFLINE_URL,
  '/src/styles/app.css',
  '/public/manifest.json',
  '/public/favicon.svg',
  '/public/icon-192.png',
  '/public/icon-512.png'
];

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(STATIC_CACHE).then(cache => cache.addAll(PRECACHE_URLS)).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(
        keys.filter(key => key !== STATIC_CACHE && key !== DATA_CACHE).map(key => caches.delete(key))
      ))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', event => {
  const { request } = event;
  if (request.method !== 'GET') return; // never intercept Firebase writes
  const url = new URL(request.url);
  if (url.origin !== self.location.origin && !isFirebaseApiRequest(request.url)) return;

  // issue #264 — never intercept RTDB's long-polling streaming fallback;
  // let it pass straight to the network like a write.
  if (isRealtimeDbStreamingRequest(request.url)) return;

  if (isFirebaseApiRequest(request.url)) {
    event.respondWith(
      caches.open(DATA_CACHE).then(cache =>
        networkFirst(request, cache).catch(() => {
          throw new Error('offline and no cached data for this request');
        })
      )
    );
    return;
  }

  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request).catch(() =>
        caches.match(request).then(cached => cached || caches.match(OFFLINE_URL))
      )
    );
    return;
  }

  event.respondWith(
    caches.open(STATIC_CACHE).then(cache =>
      cacheFirst(request, cache).catch(() => caches.match(OFFLINE_URL))
    )
  );
});

// Daily Todo local reminder notifications (issue #132) — showNotification()
// is called by reminderScheduler.js's own setTimeout, not here; this handler
// only reacts to the user clicking one. Focuses an existing app window if
// one is open, or opens a new one at the Daily Todos panel's location
// (.claude/rules/roadmap-store.md's "Placement" note) otherwise.
self.addEventListener('notificationclick', event => {
  event.notification.close();
  event.waitUntil(
    self.clients.matchAll({ type: 'window' }).then(clients => {
      const existing = findClientToFocus(clients);
      if (existing) return existing.focus();
      return self.clients.openWindow(getReminderTargetUrl());
    })
  );
});
