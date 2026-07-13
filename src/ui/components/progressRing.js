import { svgEl } from '../utils/svg.js';

// Issue #6 Phase 3.7 — small animated SVG circular progress ring. `size` in
// px, `strokeWidth` in px; the track (background circle) uses `--track-bg`,
// the fill uses `--brand`, matching `.progress-track`/`.progress-fill`'s
// existing linear equivalent so both progress affordances read consistently.
//
// issue #155 — `variant: 'dotted'` renders the *track* circle (never the
// fill) as short, evenly-spaced dashes instead of a continuous stroke,
// matching the Neura reference's gauge rings. Added as an opt-in option
// rather than replacing the continuous-stroke default: only the two
// headline dashboard gauges (`dashboard.js`) opt in for now, every other
// existing per-item ring keeps today's look — see .claude/rules/
// ui-styling.md's Visual design language section for which call sites use
// which variant and why. The dash count is fixed at 40 regardless of size
// (rather than scaling with radius) so the dash/gap rhythm stays visually
// consistent across every size this component is used at.
const DOTTED_TRACK_SEGMENTS = 40;

export function createProgressRing(pct = 0, { size = 40, strokeWidth = 4, variant = 'solid' } = {}) {
  if (variant !== 'solid' && variant !== 'dotted') {
    throw new Error(`createProgressRing: unrecognized variant "${variant}" (expected "solid" or "dotted")`);
  }
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const center = size / 2;

  const svg = svgEl('svg', {
    class: `progress-ring${variant === 'dotted' ? ' progress-ring-dotted' : ''}`,
    width: size,
    height: size,
    viewBox: `0 0 ${size} ${size}`,
    role: 'img',
    'aria-label': `${Math.round(pct)}% complete`
  });

  const trackAttrs = {
    class: 'progress-ring-track',
    cx: center,
    cy: center,
    r: radius,
    fill: 'none',
    'stroke-width': strokeWidth
  };
  if (variant === 'dotted') {
    // Evenly-spaced short dashes: each segment's "on" length is a small
    // fraction of the gap between segments so the dashes read as discrete
    // dots/ticks rather than a broken-up continuous line.
    const segmentLength = circumference / DOTTED_TRACK_SEGMENTS;
    trackAttrs['stroke-dasharray'] = `${(segmentLength * 0.35).toFixed(2)} ${(segmentLength * 0.65).toFixed(2)}`;
    trackAttrs['stroke-linecap'] = 'round';
  }
  const track = svgEl('circle', trackAttrs);

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
