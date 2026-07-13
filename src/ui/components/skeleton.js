import { el } from '../dom.js';

// Issue #6 Phase 3.1 — shimmer-animated placeholders shown during initial
// data load, to avoid layout shift and communicate loading state before real
// content is ready. Wired into progress.js (issue #125) for the one load
// state in this app slow enough to need it: chartWrapper.js's first-ever
// Chart.js CDN import. A reusable primitive for any future genuinely slow
// initial load — same as progressRing.js.
export function createSkeletonText() {
  return el('div', { className: 'skeleton skeleton-text', 'aria-hidden': 'true' });
}

export function createSkeletonCard() {
  return el('div', { className: 'skeleton skeleton-card', 'aria-hidden': 'true' });
}
