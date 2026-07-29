// IntersectionObserver-based scroll-reveal helper (design-system.md §7,
// issue #416 Phase 3). Adds `.is-revealed` once an element is ~80px into the
// viewport, then unobserves — mirrors the portfolio's `whileInView`/
// `viewport={{ once: true }}` Framer Motion behavior, rebuilt in vanilla JS
// since this app has no build step and can't add a React-only dependency.

const REVEAL_ROOT_MARGIN = '0px 0px -80px 0px';

function prefersReducedMotion() {
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

// Returns the IntersectionObserver instance (or null under reduced motion,
// where `.is-revealed` is added synchronously instead) so callers that want
// to tear it down early can, though most call sites let it unobserve itself.
export function observeReveal(el, { delay } = {}) {
  if (delay) el.classList.add(`reveal-delay-${delay}`);

  // jsdom (this app's unit-test environment) has no IntersectionObserver at
  // all — fall back to the same synchronous reveal reduced-motion uses,
  // rather than throwing on every page/component test that mounts a reveal.
  if (prefersReducedMotion() || typeof window.IntersectionObserver === 'undefined') {
    el.classList.add('is-revealed');
    return null;
  }

  const observer = new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
      if (!entry.isIntersecting) return;
      el.classList.add('is-revealed');
      observer.unobserve(el);
    });
  }, { threshold: 0, rootMargin: REVEAL_ROOT_MARGIN });

  observer.observe(el);
  return observer;
}
