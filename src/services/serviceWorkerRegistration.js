// Registers sw.js (issue #19). Kept out of main.js's top-level flow since
// service workers require HTTPS or localhost and aren't available in every
// test/dev environment (jsdom has no navigator.serviceWorker) — this module
// no-ops safely when the API isn't present instead of throwing.
//
// sw.js's own skipWaiting()/clients.claim() hand control of an already-open
// tab to a newly-activated worker, but that doesn't retroactively change code
// already loaded into that tab's JS runtime — a tab only actually starts
// fetching through the new CACHE_VERSION on its next full navigation. A
// laptop dev tab gets refreshed/reopened often enough that this is invisible;
// a mobile PWA install or a backgrounded-then-resumed tab can stay on one
// navigation for days, so it kept serving a stale bundle even after a new
// version deployed. `controllerchange` fires exactly once, when the new
// worker takes over — reload there so every client picks up the new
// deploy on the next tick instead of waiting for a manual refresh.
//
// Issue #402 follow-up — the fix above only ever fires once the browser has
// already fetched a byte-different sw.js and installed the new worker, and a
// service worker's own update check only runs automatically on a real page
// navigation. A tab that never navigates away (a long-lived background tab,
// an installed PWA kept open, or a session that just stays on the same SPA
// hash route for a long time) can go a long time without the browser ever
// re-checking sw.js for changes — reproduced live against production, where
// a session sat on a superseded CACHE_VERSION indefinitely with no user
// action able to notice or fix it short of manually clearing site data.
// `registration.update()` is the same check the browser itself would
// eventually run on navigation, just triggered proactively instead of left
// to chance — on a recurring interval (so a tab that never regains focus
// still checks periodically) and immediately whenever the tab regains
// visibility/focus (so returning to a backgrounded tab checks right away
// instead of waiting out the rest of the interval). This requires no action
// from the user on any device — the existing silent reload-on-`controllerchange`
// behavior above is unchanged, this only makes sure it actually gets a chance
// to fire.
const UPDATE_CHECK_INTERVAL_MS = 60 * 60 * 1000; // 1 hour

export function registerServiceWorker() {
  if (!('serviceWorker' in navigator)) return;

  // A page with no controller yet (first-ever visit, or a hard refresh that
  // bypassed the SW) also fires `controllerchange` the moment its worker
  // first takes control — that's not an update, so only reload when this
  // tab was already under an old worker's control beforehand.
  const hadController = Boolean(navigator.serviceWorker.controller);

  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js', { type: 'module' })
      .then(registration => {
        if (!registration) return;
        scheduleUpdateChecks(registration);
      })
      .catch(error => {
        console.error('Service worker registration failed:', error);
      });
  });

  let reloaded = false;
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (reloaded || !hadController) return;
    reloaded = true;
    window.location.reload();
  });
}

function scheduleUpdateChecks(registration) {
  const checkForUpdate = () => registration.update().catch(() => {});

  setInterval(checkForUpdate, UPDATE_CHECK_INTERVAL_MS);

  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') checkForUpdate();
  });
  window.addEventListener('focus', checkForUpdate);
}
