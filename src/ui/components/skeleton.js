import { el } from '../dom.js';

// Issue #6 Phase 3.1 — shimmer-animated placeholders shown during initial
// data load, to avoid layout shift and communicate loading state before real
// content is ready. Not wired into any page yet (nothing in this app today
// has a load state slow enough to need one) — a primitive for a later phase
// to reach for, same as progressRing.js/tabs.js in this same PR.
export function createSkeletonText() {
  return el('div', { className: 'skeleton skeleton-text', 'aria-hidden': 'true' });
}

export function createSkeletonCard() {
  return el('div', { className: 'skeleton skeleton-card', 'aria-hidden': 'true' });
}
