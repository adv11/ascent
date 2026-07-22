const SVG_NS = 'http://www.w3.org/2000/svg';

// Shared low-level SVG builder — replaces the 3-4 copy-pasted `svgEl`
// helpers that used to live independently in brand.js, landing.js,
// authMarketingPanel.js, and progressRing.js (issue #107).
export function svgEl(tag, attrs = {}) {
  const node = document.createElementNS(SVG_NS, tag);
  Object.entries(attrs).forEach(([key, value]) => node.setAttribute(key, value));
  return node;
}

// Builds a 24x24 line-icon <svg> from a list of shape descriptors, each
// `{ tag = 'path', ...attrs }`. `stroke`/`fill`/`stroke-width`/`stroke-linecap`/
// `stroke-linejoin` default to Lucide's own native rendering style (currentColor
// stroke, no fill, 2px stroke width, round caps/joins — design-system.md §5's
// "Icons: Lucide only... stroke-width 2") so call sites only need to specify the
// geometry — pass any of those keys per-shape to override. Bumped from the
// pre-Lucide 1.8 default in issue #301 (Phase 5's icon migration) — Lucide's own
// shapes are drawn assuming round caps/joins at stroke-width 2; rendering them
// without those produces subtly wrong (jagged-joint, thin) icons. `viewBox`
// defaults to `24 24`, Lucide's native viewBox — overridable per call for any
// non-Lucide decorative SVG that still needs a different one.
export function svgIcon(shapes, { size = 24, viewBox = '0 0 24 24' } = {}) {
  const svg = svgEl('svg', {
    viewBox,
    width: String(size),
    height: String(size),
    'aria-hidden': 'true',
    focusable: 'false'
  });
  shapes.forEach(({ tag = 'path', ...attrs }) => svg.append(svgEl(tag, {
    fill: 'none',
    stroke: 'currentColor',
    'stroke-width': '2',
    'stroke-linecap': 'round',
    'stroke-linejoin': 'round',
    ...attrs
  })));
  return svg;
}
