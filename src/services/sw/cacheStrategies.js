// Pure cache-strategy functions shared by sw.js (the actual service worker)
// and its unit tests (issue #19). Kept dependency-free — no DOM, no `self` —
// so tests can mock the Cache API's `caches`/`fetch` without a full service
// worker test environment.

// Firebase Realtime Database + Auth REST calls only — never the Firebase SDK
// CDN URLs themselves (those have their own CDN caching, see CLAUDE.md notes
// for this issue). Matched by hostname, not path, since both products spread
// requests across several path shapes.
const FIREBASE_API_HOSTS = ['firebaseio.com', 'googleapis.com'];

export function isFirebaseApiRequest(url) {
  const hostname = new URL(url).hostname;
  return FIREBASE_API_HOSTS.some(host => hostname.endsWith(host));
}

// Realtime Database's `onValue`/`onDisconnect` listeners normally stream over
// a `wss://` WebSocket, invisible to `fetch`/service-worker interception —
// but when WebSockets are unavailable (corporate proxies, some mobile
// carriers/VPNs, certain privacy modes) the SDK transparently falls back to
// long-polling: repeated GETs to a `/.lp` channel that the server
// intentionally holds open for ~25-30s waiting for data. `networkFirst()`
// `await`s the full response and clones/caches it — fine for a normal GET,
// but it buffers/interferes with a deliberately-held-open streaming
// response, so the SDK's transport layer never gets the chunk it's waiting
// for: no error (so `onError` never fires) and no data (so the success
// callback never fires either) — a silent, permanent hang. Route these
// straight to the network with no caching, same as a Firebase write.
export function isRealtimeDbStreamingRequest(url) {
  const { hostname, pathname } = new URL(url);
  if (!hostname.endsWith('firebaseio.com')) return false;
  return pathname.startsWith('/.lp') || pathname.startsWith('/.ws');
}

// Cache-first: static, first-party assets (JS/CSS/fonts/icons) rarely change
// mid-session, and a cache hit avoids a network round-trip entirely. Falls
// back to network + caches the response for next time.
export async function cacheFirst(request, cache, fetcher = fetch) {
  const cached = await cache.match(request);
  if (cached) return cached;
  const response = await fetcher(request);
  if (response.ok) cache.put(request, response.clone());
  return response;
}

// Network-first with stale fallback: Firebase data should always be as
// fresh as possible, but an offline user should see their last-synced data
// instead of a hard failure. Only successful, cacheable (GET) responses are
// cached — Firebase writes must never be cached or replayed against cache.
export async function networkFirst(request, cache, fetcher = fetch) {
  try {
    const response = await fetcher(request);
    if (response.ok && request.method === 'GET') cache.put(request, response.clone());
    return response;
  } catch (networkError) {
    const cached = await cache.match(request);
    if (cached) return cached;
    throw networkError;
  }
}
