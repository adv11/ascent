// Toggles `[data-scrolling]` on <html> for the duration of an active scroll,
// anywhere in the app (window scroll, or a scroll bubbling up from any
// scrollable descendant — the sidebar's own overflow-y:auto, a modal list,
// etc.). app.css reads this attribute to temporarily drop backdrop-filter on
// the app's glass surfaces (.app-topbar, .app-sidebar, .card, .phase-card,
// .template-card, .tag-chip) — see the block comment above that rule in
// app.css for why: those surfaces must otherwise re-blur whatever's
// instantaneously behind them on every single scroll frame, which is
// guaranteed to change every frame for the two always-visible sticky
// elements, and adds up fast across a grid of simultaneously visible glass
// cards. This is the same "flatten the expensive surface while it's most
// expensive, restore it once idle" trade the pre-existing
// `.phase-card.open` fix (issue #416 Phase 5) already made for tall expanded
// phase cards specifically — this generalizes it to every glass surface, for
// the whole duration of any scroll, not just one element's expanded state.
//
// rAF-throttled so the attribute is set at most once per frame regardless of
// how many scroll events fire; cleared via a plain debounce (no rAF needed
// for the clear — it only needs to happen once, shortly after scrolling
// actually stops).
const SCROLL_END_DELAY_MS = 150;

let scrollEndTimer = null;
let rafScheduled = false;

function onScroll() {
  if (!rafScheduled) {
    rafScheduled = true;
    requestAnimationFrame(() => {
      document.documentElement.setAttribute('data-scrolling', '');
      rafScheduled = false;
    });
  }
  clearTimeout(scrollEndTimer);
  scrollEndTimer = setTimeout(() => {
    document.documentElement.removeAttribute('data-scrolling');
  }, SCROLL_END_DELAY_MS);
}

// App-lifetime, never torn down — same precedent as initTheme()/
// initReminderScheduler() in main.js, none of which have a matching cleanup
// path either, since they're only ever initialized once for the whole
// session, not per-route.
export function initScrollPerfMode() {
  window.addEventListener('scroll', onScroll, { passive: true, capture: true });
}
