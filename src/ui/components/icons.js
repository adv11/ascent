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
  // A gear/cog, not the sun-with-rays glyph a plain circle + 8 straight
  // spokes reads as (reported live — indistinguishable from a light-theme
  // toggle at 20px). Toothed-ring path adapted from Feather's "settings"
  // icon (MIT licensed) for a shape that's unambiguously a gear at small
  // sizes, with the same currentColor/1.8-stroke/round-cap treatment every
  // other icon here uses.
  settings: () => [
    { tag: 'circle', cx: '12', cy: '12', r: '3', 'stroke-linecap': 'round', 'stroke-linejoin': 'round' },
    {
      d: 'M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z',
      'stroke-linecap': 'round',
      'stroke-linejoin': 'round'
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
  ],
  // Streak stat card (issue #8) — a simple flame outline, same minimalist
  // line-art treatment as every other icon here (no fill, currentColor
  // stroke, round joins).
  flame: () => [
    {
      d: 'M12 21c-4 0-6.5-2.5-6.5-6 0-3 2-5 3-7.5C9.5 5 10 3 12 2c0 2 .5 3.5 2 5 1.5 1.5 2.5 3.5 2.5 6 0 3.5-2.5 6-6 6z',
      'stroke-linecap': 'round', 'stroke-linejoin': 'round'
    },
    {
      d: 'M12 21a3 3 0 0 0 3-3c0-1.5-1-2.5-1.5-3.5.2 1-.3 2-1.5 2-1 0-1.5-.7-1.3-1.7-1 1-1.7 2-1.7 3.2a3 3 0 0 0 3 3z',
      'stroke-linecap': 'round', 'stroke-linejoin': 'round'
    }
  ],
  // Velocity stat card (issue #8) — adapted from Feather's "trending-up"
  // icon (MIT licensed), same precedent as the settings gear above.
  trendingUp: () => [
    { d: 'M4 16l6-6 4 4 6-7', 'stroke-linecap': 'round', 'stroke-linejoin': 'round' },
    { d: 'M15 7h5v5', 'stroke-linecap': 'round', 'stroke-linejoin': 'round' }
  ],
  // Progress sidebar nav item (issue #8) — three ascending bars, distinct
  // from `trendingUp`'s line-chart shape so the nav icon and a stat-tile
  // icon never look interchangeable at a glance.
  progress: () => [
    { d: 'M5 20v-8', 'stroke-linecap': 'round' },
    { d: 'M12 20V6', 'stroke-linecap': 'round' },
    { d: 'M19 20v-5', 'stroke-linecap': 'round' }
  ],
  // Share button (issue #8) — adapted from Feather's "share" icon (box +
  // up-arrow), same precedent as the settings gear above.
  share: () => [
    { d: 'M12 15V3', 'stroke-linecap': 'round', 'stroke-linejoin': 'round' },
    { d: 'M8 7l4-4 4 4', 'stroke-linecap': 'round', 'stroke-linejoin': 'round' },
    { d: 'M5 12v6a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-6', 'stroke-linecap': 'round', 'stroke-linejoin': 'round' }
  ],
  // Notification bell — the topbar "What's New" changelog trigger (issue
  // #20), adapted from Feather's "bell" icon (MIT licensed), same precedent
  // as the settings gear above.
  bell: () => [
    { d: 'M6 10.5a6 6 0 0 1 12 0c0 4 1.5 5.5 1.5 5.5h-15S6 14.5 6 10.5z', 'stroke-linecap': 'round', 'stroke-linejoin': 'round' },
    { d: 'M10.3 19.5a1.9 1.9 0 0 0 3.4 0', 'stroke-linecap': 'round', 'stroke-linejoin': 'round' }
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
