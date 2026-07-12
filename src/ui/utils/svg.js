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
// `{ tag = 'path', ...attrs }`. `stroke`/`fill`/`stroke-width` default to the
// app's one shared icon style (currentColor stroke, no fill, 1.8 stroke
// width) so call sites only need to specify the geometry — pass any of
// those keys per-shape to override (e.g. a filled dot). `viewBox` defaults to
// `24 24` (this app's hand-drawn line icons) but is overridable per call —
// issue #136 Phase 2's Phosphor-sourced icons ship in their native `256 256`
// viewBox as filled paths (`fill: 'currentColor', stroke: 'none'` per shape),
// not this module's stroke-icon defaults.
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
    'stroke-width': '1.8',
    ...attrs
  })));
  return svg;
}
