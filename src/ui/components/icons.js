import { svgIcon } from '../utils/svg.js';

// Curated named icon set for functional/navigational chrome (issue #107) —
// every icon used as UI chrome (nav, buttons, toolbars, status) should come
// from here rather than a fresh Unicode/emoji glyph. Decorative, data-driven
// glyphs (per-template icons in src/data/templates/index.js, resource-type
// badges from linkDetector.js) are explicitly out of scope — see
// .claude/rules/ui-styling.md's "Icon system" section.
const ICON_SHAPES = {
  dashboard: () => [
    { d: 'M4 11.5 L12 4 L20 11.5', 'stroke-linecap': 'round', 'stroke-linejoin': 'round' },
    { d: 'M6 10v9a1 1 0 0 0 1 1h10a1 1 0 0 0 1-1v-9', 'stroke-linecap': 'round', 'stroke-linejoin': 'round' }
  ],
  roadmaps: () => [
    { tag: 'rect', x: '5', y: '3.5', width: '14', height: '17', rx: '2' },
    { d: 'M9 3.5v3h6v-3', 'stroke-linecap': 'round', 'stroke-linejoin': 'round' },
    { d: 'M8.5 12h7M8.5 15.5h7', 'stroke-linecap': 'round' }
  ],
  settings: () => [
    { tag: 'circle', cx: '12', cy: '12', r: '3.2' },
    {
      d: 'M12 3.5v2.2M12 18.3v2.2M20.5 12h-2.2M5.7 12H3.5M17.6 6.4l-1.55 1.55M7.95 16.05 6.4 17.6M17.6 17.6l-1.55-1.55M7.95 7.95 6.4 6.4',
      'stroke-linecap': 'round'
    }
  ],
  signOut: () => [
    { d: 'M12 4v7', 'stroke-linecap': 'round' },
    { d: 'M7 6.2a7.5 7.5 0 1 0 10 0', 'stroke-linecap': 'round' }
  ],
  menu: () => [
    { d: 'M4 6.5h16M4 12h16M4 17.5h16', 'stroke-linecap': 'round' }
  ],
  collapse: () => [
    { d: 'M15 5l-7 7 7 7', 'stroke-linecap': 'round', 'stroke-linejoin': 'round' }
  ],
  chevron: () => [
    { d: 'M9 5l7 7-7 7', 'stroke-linecap': 'round', 'stroke-linejoin': 'round' }
  ],
  check: () => [
    { d: 'M5 12.5l4.5 4.5L19 7', 'stroke-linecap': 'round', 'stroke-linejoin': 'round' }
  ],
  search: () => [
    { tag: 'circle', cx: '11', cy: '11', r: '6.5' },
    { d: 'M20 20l-4.3-4.3', 'stroke-linecap': 'round' }
  ],
  timer: () => [
    { tag: 'circle', cx: '12', cy: '13', r: '8' },
    { d: 'M12 9v4l3 2', 'stroke-linecap': 'round', 'stroke-linejoin': 'round' },
    { d: 'M9.5 2.5h5', 'stroke-linecap': 'round' }
  ],
  note: () => [
    { tag: 'rect', x: '5', y: '3.5', width: '14', height: '17', rx: '2' },
    { d: 'M8.5 8h7M8.5 11.5h7M8.5 15h4.5', 'stroke-linecap': 'round' }
  ],
  info: () => [
    { tag: 'circle', cx: '12', cy: '12', r: '8.5' },
    { d: 'M12 11v5.5', 'stroke-linecap': 'round' },
    { tag: 'circle', cx: '12', cy: '8', r: '0.9', fill: 'currentColor', stroke: 'none' }
  ],
  trash: () => [
    { d: 'M5 7h14', 'stroke-linecap': 'round' },
    { d: 'M9.5 7V5a1.5 1.5 0 0 1 1.5-1.5h2A1.5 1.5 0 0 1 14.5 5v2', 'stroke-linecap': 'round', 'stroke-linejoin': 'round' },
    { d: 'M7.5 7l.7 12a2 2 0 0 0 2 1.9h3.6a2 2 0 0 0 2-1.9l.7-12', 'stroke-linecap': 'round', 'stroke-linejoin': 'round' },
    { d: 'M10.3 10.5v6M13.7 10.5v6', 'stroke-linecap': 'round' }
  ],
  close: () => [
    { d: 'M6 6l12 12M18 6L6 18', 'stroke-linecap': 'round' }
  ],
  plus: () => [
    { d: 'M12 5v14M5 12h14', 'stroke-linecap': 'round' }
  ],
  edit: () => [
    { d: 'M15.5 4.5l4 4-9.5 9.5-4.6.6.6-4.6z', 'stroke-linecap': 'round', 'stroke-linejoin': 'round' },
    { d: 'M13.5 6.5l4 4', 'stroke-linecap': 'round' }
  ],
  sparkle: () => [
    { d: 'M12 3.5l1.7 4.8 4.8 1.7-4.8 1.7L12 16.5l-1.7-4.8-4.8-1.7 4.8-1.7z', 'stroke-linejoin': 'round' },
    { d: 'M19 15l.85 2.15L22 18l-2.15.85L19 21l-.85-2.15L16 18l2.15-.85z', 'stroke-linejoin': 'round' }
  ]
};

const VALID_SIZES = new Set(['xs', 'sm', 'md', 'lg']);

// `size` picks one of the --icon-size-* tokens (app.css) via a discrete
// modifier class — never an inline style, since index.html's CSP has no
// unsafe-inline for style-src (see .claude/rules/ui-styling.md). Defaults to
// "sm" (20px), the app's most common chrome-icon size. Returns the bare
// <svg> node (already aria-hidden, from svgIcon) — callers drop it straight
// into whichever wrapper element/class they already had (e.g.
// `el('span', { className: 'nav-item-icon' }, [createIcon('settings')])`),
// the same way brand.js's createBrandIcon() wraps its own raw svg.
export function createIcon(name, { size = 'sm' } = {}) {
  const shapes = ICON_SHAPES[name];
  if (!shapes) throw new Error(`Unknown icon: "${name}"`);
  if (!VALID_SIZES.has(size)) throw new Error(`Unknown icon size: "${size}"`);
  const svg = svgIcon(shapes());
  svg.setAttribute('class', `icon icon-${size}`);
  return svg;
}
