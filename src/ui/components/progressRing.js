import { svgEl } from '../utils/svg.js';

// Issue #6 Phase 3.7 — small animated SVG circular progress ring. `size` in
// px, `strokeWidth` in px; the track (background circle) uses `--track-bg`.
// issue #206 §7 originally struck this with a var(--gradient-alpenglow)
// <linearGradient>; a later user decision in the same PR reverted every
// gradient app-wide back to solid color, so the fill is a flat
// `var(--color-brand-gold)` stroke again (set via app.css's
// `.progress-ring-fill` rule, not inline) — no <defs>/<linearGradient>
// needed.
export function createProgressRing(pct = 0, { size = 40, strokeWidth = 4 } = {}) {
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const center = size / 2;

  const svg = svgEl('svg', {
    class: 'progress-ring',
    width: size,
    height: size,
    viewBox: `0 0 ${size} ${size}`,
    role: 'img',
    'aria-label': `${Math.round(pct)}% complete`
  });

  const track = svgEl('circle', {
    class: 'progress-ring-track',
    cx: center,
    cy: center,
    r: radius,
    fill: 'none',
    'stroke-width': strokeWidth
  });

  const fill = svgEl('circle', {
    class: 'progress-ring-fill',
    cx: center,
    cy: center,
    r: radius,
    fill: 'none',
    'stroke-width': strokeWidth,
    'stroke-linecap': 'round',
    'stroke-dasharray': circumference,
    'stroke-dashoffset': circumference,
    transform: `rotate(-90 ${center} ${center})`
  });

  svg.append(track, fill);

  function setPct(nextPct) {
    const clamped = Math.max(0, Math.min(100, nextPct));
    fill.setAttribute('stroke-dashoffset', String(circumference * (1 - clamped / 100)));
    svg.setAttribute('aria-label', `${Math.round(clamped)}% complete`);
  }

  setPct(pct);
  svg._setPct = setPct;
  return svg;
}
