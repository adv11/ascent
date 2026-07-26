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
export function registerServiceWorker() {
  if (!('serviceWorker' in navigator)) return;

  // A page with no controller yet (first-ever visit, or a hard refresh that
  // bypassed the SW) also fires `controllerchange` the moment its worker
  // first takes control — that's not an update, so only reload when this
  // tab was already under an old worker's control beforehand.
  const hadController = Boolean(navigator.serviceWorker.controller);

  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js', { type: 'module' }).catch(error => {
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
