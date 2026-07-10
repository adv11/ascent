// Guards against a one-time Firebase read (`get()`) that never settles —
// a real, observed failure mode (not hypothetical): Firebase's Realtime
// Database SDK has no built-in timeout, so a stalled WebSocket connection
// (a strict content/tracker blocker holding a `firebaseio.com` connection
// open-but-silent, a flaky network, a corporate proxy) leaves the returned
// promise pending forever. Every caller of the wrapped methods below
// (`FirebaseAdapter.getRoadmap`/`getMeta`/`getLegacyRoadmap`) already
// try/catches the call and falls back to a local blob or a fresh seed —
// see `.claude/rules/roadmap-store.md` — so turning an infinite hang into a
// timely rejection is a pure UX fix: it lets that existing fallback logic
// run instead of leaving the caller (e.g. onboarding.js's `pickTemplate()`)
// stuck in a "picking" state with no escape but a page reload.
export function withTimeout(promise, ms, message) {
  let timer;
  const timeout = new Promise((_, reject) => {
    timer = setTimeout(() => reject(new Error(message)), ms);
  });
  return Promise.race([promise, timeout]).finally(() => clearTimeout(timer));
}
