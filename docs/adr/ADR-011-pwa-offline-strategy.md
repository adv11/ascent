# ADR-011: PWA offline caching strategy — cache-first for static assets, network-first for Firebase data

## Status

Accepted (issue #19).

## Context

Ascent is a pure static site with no PWA manifest/service worker prior to this issue — no
install prompt, no offline fallback (a blank page on a network failure), and a failing
Lighthouse PWA audit. Two different kinds of content are served: first-party static assets
(JS modules, CSS, icons) that only change on deploy, and Firebase Realtime Database/Auth
data that can change at any time and must stay as fresh as possible while the user is online.

## Decision

Two distinct caching strategies, chosen per request type rather than one blanket strategy:

- **Cache-first** for same-origin static assets. These rarely change mid-session — a cache
  hit avoids a network round-trip entirely, and correctness only requires bumping
  `CACHE_VERSION` (`sw.js`) on any deploy that changes them, which busts every cache name and
  forces a re-fetch on `activate`.
- **Network-first with a stale-cache fallback** for Firebase Realtime Database/Auth REST
  calls (matched by hostname — `firebaseio.com`, `googleapis.com` — never by path, since both
  products spread requests across several path shapes). A live network response is always
  preferred; only on failure does the last cached response get served, paired with a toast
  ("You're offline — showing last synced data.") so the user knows the data isn't live.
- **No caching of Firebase SDK CDN URLs.** The CDN already has its own caching; double-caching
  buys nothing and adds another cache to keep in sync.
- **No caching of non-GET requests.** Firebase writes must never be cached or replayed against
  cache — `networkFirst()` only caches `request.method === 'GET'`.

**Background sync was considered and rejected** for this issue's scope. Ascent's writes go
through the Firebase SDK directly (not through `fetch()` intercepted by the service worker),
so a queued-write replay via the service worker's own `fetch` handler wouldn't actually capture
them — the SDK has its own retry/offline-persistence behavior already. Revisit only if a future
issue moves writes through a custom REST layer the service worker can see.

## Consequences

- The two strategies are pure functions (`src/services/sw/cacheStrategies.js`), independent of
  `self`/DOM, specifically so they're unit-testable with a mocked `Cache`/`fetch` — jsdom has no
  real service-worker environment, and a from-scratch mock service worker test harness was
  judged not worth the setup cost for this app's size.
- `sw.js` is registered as an ES module (`{ type: 'module' }`) to import
  `cacheStrategies.js` directly rather than duplicating its logic — consistent with the rest of
  this app's no-build-step, native-ES-module architecture. This has slightly narrower browser
  support than a classic-script service worker (older Safari versions don't support module
  service workers); acceptable since the app already assumes evergreen browsers for its
  `type="module"` `main.js` entry point with no fallback.
- Maskable icons and install-dialog screenshots are out of scope for this PR (see the
  CHANGELOG/Build Log entry) — both need actual image work, not just a manifest field.
