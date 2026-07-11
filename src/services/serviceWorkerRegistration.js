// Registers sw.js (issue #19). Kept out of main.js's top-level flow since
// service workers require HTTPS or localhost and aren't available in every
// test/dev environment (jsdom has no navigator.serviceWorker) — this module
// no-ops safely when the API isn't present instead of throwing.
export function registerServiceWorker() {
  if (!('serviceWorker' in navigator)) return;
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js', { type: 'module' }).catch(error => {
      console.error('Service worker registration failed:', error);
    });
  });
}
