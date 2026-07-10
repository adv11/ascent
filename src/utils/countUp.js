// Issue #6 Phase 4.1 — requestAnimationFrame-driven number count-up for stat
// tiles. Text content isn't animatable via CSS transitions, so this is a
// small imperative helper rather than a CSS-only approach. Reads the
// element's own current numeric textContent as the start value (falls back
// to 0), so calling it again later would resume from wherever the last
// render left off — callers that only want this on first render (see
// dashboard.js's hasAnimatedStats guard) are responsible for only calling it
// once.
export function animateCountUp(el, to, { duration = 600, formatFn = String } = {}) {
  if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) {
    el.textContent = formatFn(to);
    return;
  }
  const from = Number.parseInt(el.textContent, 10) || 0;
  if (from === to) {
    el.textContent = formatFn(to);
    return;
  }
  const start = performance.now();
  function tick(now) {
    const elapsed = Math.min(1, (now - start) / duration);
    const eased = 1 - Math.pow(1 - elapsed, 3);
    const value = Math.round(from + (to - from) * eased);
    el.textContent = formatFn(value);
    if (elapsed < 1) requestAnimationFrame(tick);
  }
  requestAnimationFrame(tick);
}
