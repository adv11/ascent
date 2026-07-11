import { el } from '../dom.js';
import { svgEl } from '../utils/svg.js';

const BRAND_NAME = 'Ascent';

// Filled with currentColor so `.brand-mark`'s CSS color (white) still controls
// it, rather than hardcoding a color here.
function brandGlyph() {
  const svg = svgEl('svg', {
    viewBox: '0 0 24 24',
    width: '20',
    height: '20',
    'aria-hidden': 'true',
    focusable: 'false'
  });
  svg.append(svgEl('path', { d: 'M12 4 L20 18 L4 18 Z', fill: 'currentColor' }));
  return svg;
}

export function createBrandIcon() {
  return el('span', { className: 'brand-mark' }, [brandGlyph()]);
}

export function createBrandWordmark() {
  return el('span', { className: 'brand-name', text: BRAND_NAME });
}

// Returns an array of children (icon + name), not a pre-wrapped container, so
// callers keep their own `.brand`-classed wrapper (an <a> on auth pages, a
// <div> on the dashboard header).
export function createBrandMark({ tagline } = {}) {
  const icon = createBrandIcon();
  if (tagline) {
    return [
      icon,
      el('div', {}, [
        createBrandWordmark(),
        el('div', { className: 'brand-tagline', text: tagline })
      ])
    ];
  }
  return [icon, createBrandWordmark()];
}
