import { svgIcon } from '../utils/svg.js';

// Curated named icon set for functional/navigational chrome (issue #107).
// Migrated from hand-redrawn Phosphor Regular paths to real Lucide source
// paths in issue #301 (Phase 5 of the v2 "Modernist" redesign) — every icon
// used as UI chrome (nav, buttons, toolbars, status) should come from here
// rather than a fresh Unicode/emoji glyph. Decorative, data-driven glyphs
// (per-template icons in src/data/templates/index.js, resource-type badges
// from linkDetector.js, custom-roadmap card icons) come from
// decorativeIcon.js's own Lucide set instead — see
// .claude/rules/design-system.md §5 ("Icons: Lucide only — inline SVG,
// currentColor, stroke-width 2. No emoji, no Phosphor Duotone") for the full
// policy this migration satisfies.
//
// Each shape here is a `{ tag?, ...svgAttrs }` descriptor lifted verbatim
// from Lucide's own 24x24-viewBox SVG source (lucide-static, ISC licensed) —
// `svg.js`'s `svgIcon()` fills in the shared stroke/fill/cap/join defaults
// (`currentColor` stroke, no fill, 2px width, round caps/joins) that match
// Lucide's own native rendering, so shapes below only need geometry
// attributes (`d`, or `cx`/`cy`/`r`, or `x1`/`y1`/`x2`/`y2`, etc.) — never
// `fill`/`stroke`. The `// lucide: <name>` comment above each entry names the
// exact upstream icon a shape was sourced from, for anyone diffing against a
// future Lucide update.
const ICON_SHAPES = {
  // lucide: layout-dashboard
  dashboard: () => [
    { tag: 'rect', width: '7', height: '9', x: '3', y: '3', rx: '1' },
    { tag: 'rect', width: '7', height: '5', x: '14', y: '3', rx: '1' },
    { tag: 'rect', width: '7', height: '9', x: '14', y: '12', rx: '1' },
    { tag: 'rect', width: '7', height: '5', x: '3', y: '16', rx: '1' }
  ],
  // lucide: map
  roadmaps: () => [
    { d: 'M14.106 5.553a2 2 0 0 0 1.788 0l3.659-1.83A1 1 0 0 1 21 4.619v12.764a1 1 0 0 1-.553.894l-4.553 2.277a2 2 0 0 1-1.788 0l-4.212-2.106a2 2 0 0 0-1.788 0l-3.659 1.83A1 1 0 0 1 3 19.381V6.618a1 1 0 0 1 .553-.894l4.553-2.277a2 2 0 0 1 1.788 0z' },
    { d: 'M15 5.764v15' },
    { d: 'M9 3.236v15' }
  ],
  // lucide: settings
  settings: () => [
    { d: 'M9.671 4.136a2.34 2.34 0 0 1 4.659 0 2.34 2.34 0 0 0 3.319 1.915 2.34 2.34 0 0 1 2.33 4.033 2.34 2.34 0 0 0 0 3.831 2.34 2.34 0 0 1-2.33 4.033 2.34 2.34 0 0 0-3.319 1.915 2.34 2.34 0 0 1-4.659 0 2.34 2.34 0 0 0-3.32-1.915 2.34 2.34 0 0 1-2.33-4.033 2.34 2.34 0 0 0 0-3.831A2.34 2.34 0 0 1 6.35 6.051a2.34 2.34 0 0 0 3.319-1.915' },
    { tag: 'circle', cx: '12', cy: '12', r: '3' }
  ],
  // lucide: log-out
  signOut: () => [
    { d: 'm16 17 5-5-5-5' },
    { d: 'M21 12H9' },
    { d: 'M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4' }
  ],
  // lucide: menu
  menu: () => [
    { d: 'M4 5h16' },
    { d: 'M4 12h16' },
    { d: 'M4 19h16' }
  ],
  // lucide: chevron-left
  collapse: () => [
    { d: 'm15 18-6-6 6-6' }
  ],
  // lucide: chevron-right
  chevron: () => [
    { d: 'm9 18 6-6-6-6' }
  ],
  // lucide: check
  check: () => [
    { d: 'M20 6 9 17l-5-5' }
  ],
  // lucide: search
  search: () => [
    { d: 'm21 21-4.34-4.34' },
    { tag: 'circle', cx: '11', cy: '11', r: '8' }
  ],
  // lucide: clock
  timer: () => [
    { d: 'M12 6v6l4 2' },
    { tag: 'circle', cx: '12', cy: '12', r: '10' }
  ],
  // lucide: rotate-ccw
  reset: () => [
    { d: 'M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8' },
    { d: 'M3 3v5h5' }
  ],
  // lucide: file-edit
  note: () => [
    { d: 'M12.659 22H18a2 2 0 0 0 2-2V8a2.4 2.4 0 0 0-.706-1.706l-3.588-3.588A2.4 2.4 0 0 0 14 2H6a2 2 0 0 0-2 2v9.34' },
    { d: 'M14 2v5a1 1 0 0 0 1 1h5' },
    { d: 'M10.378 12.622a1 1 0 0 1 3 3.003L8.36 20.637a2 2 0 0 1-.854.506l-2.867.837a.5.5 0 0 1-.62-.62l.836-2.869a2 2 0 0 1 .506-.853z' }
  ],
  // lucide: info
  info: () => [
    { d: 'M12 16v-4' },
    { d: 'M12 8h.01' },
    { tag: 'circle', cx: '12', cy: '12', r: '10' }
  ],
  // lucide: trash-2
  trash: () => [
    { d: 'M10 11v6' },
    { d: 'M14 11v6' },
    { d: 'M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6' },
    { d: 'M3 6h18' },
    { d: 'M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2' }
  ],
  // lucide: x
  close: () => [
    { d: 'M18 6 6 18' },
    { d: 'm6 6 12 12' }
  ],
  // lucide: plus
  plus: () => [
    { d: 'M5 12h14' },
    { d: 'M12 5v14' }
  ],
  // lucide: pencil
  edit: () => [
    { d: 'M21.174 6.812a1 1 0 0 0-3.986-3.987L3.842 16.174a2 2 0 0 0-.5.83l-1.321 4.352a.5.5 0 0 0 .623.622l4.353-1.32a2 2 0 0 0 .83-.497z' },
    { d: 'm15 5 4 4' }
  ],
  // lucide: sparkles
  sparkle: () => [
    { d: 'M11.017 2.814a1 1 0 0 1 1.966 0l1.051 5.558a2 2 0 0 0 1.594 1.594l5.558 1.051a1 1 0 0 1 0 1.966l-5.558 1.051a2 2 0 0 0-1.594 1.594l-1.051 5.558a1 1 0 0 1-1.966 0l-1.051-5.558a2 2 0 0 0-1.594-1.594l-5.558-1.051a1 1 0 0 1 0-1.966l5.558-1.051a2 2 0 0 0 1.594-1.594z' },
    { d: 'M20 2v4' },
    { d: 'M22 4h-4' },
    { tag: 'circle', cx: '4', cy: '20', r: '2' }
  ],
  // lucide: flame — streak stat card (issue #8)
  flame: () => [
    { d: 'M12 3q1 4 4 6.5t3 5.5a1 1 0 0 1-14 0 5 5 0 0 1 1-3 1 1 0 0 0 5 0c0-2-1.5-3-1.5-5q0-2 2.5-4' }
  ],
  // lucide: trending-up — velocity stat card (issue #8)
  trendingUp: () => [
    { d: 'M16 7h6v6' },
    { d: 'm22 7-8.5 8.5-5-5L2 17' }
  ],
  // lucide: bar-chart-3 — Progress sidebar nav item (issue #8)
  progress: () => [
    { d: 'M3 3v16a2 2 0 0 0 2 2h16' },
    { d: 'M18 17V9' },
    { d: 'M13 17V5' },
    { d: 'M8 17v-3' }
  ],
  // lucide: share-2 — share button (issue #8)
  share: () => [
    { tag: 'circle', cx: '18', cy: '5', r: '3' },
    { tag: 'circle', cx: '6', cy: '12', r: '3' },
    { tag: 'circle', cx: '18', cy: '19', r: '3' },
    { tag: 'line', x1: '8.59', x2: '15.42', y1: '13.51', y2: '17.49' },
    { tag: 'line', x1: '15.41', x2: '8.59', y1: '6.51', y2: '10.49' }
  ],
  // lucide: bell — notification bell, the topbar "What's New" changelog trigger (issue #20)
  bell: () => [
    { d: 'M10.268 21a2 2 0 0 0 3.464 0' },
    { d: 'M3.262 15.326A1 1 0 0 0 4 17h16a1 1 0 0 0 .74-1.673C19.41 13.956 18 12.499 18 8A6 6 0 0 0 6 8c0 4.499-1.411 5.956-2.738 7.326' }
  ],
  // lucide: link — the dashboard's "Resources" filter chip (issue #100 follow-up)
  link: () => [
    { d: 'M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71' },
    { d: 'M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71' }
  ],
  // lucide: sun — theme toggle (issue #136 Phase 2 follow-up)
  sun: () => [
    { d: 'M12 2v2' },
    { d: 'M12 20v2' },
    { d: 'm4.93 4.93 1.41 1.41' },
    { d: 'm17.66 17.66 1.41 1.41' },
    { d: 'M2 12h2' },
    { d: 'M20 12h2' },
    { d: 'm6.34 17.66-1.41 1.41' },
    { d: 'm19.07 4.93-1.41 1.41' },
    { tag: 'circle', cx: '12', cy: '12', r: '4' }
  ],
  // lucide: moon
  moon: () => [
    { d: 'M20.985 12.486a9 9 0 1 1-9.473-9.472c.405-.022.617.46.402.803a6 6 0 0 0 8.268 8.268c.344-.215.825-.004.803.401' }
  ],
  // lucide: triangle-alert — error status (feedbackModal.js)
  warning: () => [
    { d: 'm21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3' },
    { d: 'M12 9v4' },
    { d: 'M12 17h.01' }
  ],
  // lucide: camera — screenshot-capture button (feedbackForm.js)
  camera: () => [
    { d: 'M13.997 4a2 2 0 0 1 1.76 1.05l.486.9A2 2 0 0 0 18.003 7H20a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V9a2 2 0 0 1 2-2h1.997a2 2 0 0 0 1.759-1.048l.489-.904A2 2 0 0 1 10.004 4z' },
    { tag: 'circle', cx: '12', cy: '13', r: '3' }
  ],
  // lucide: upload — upload-image button (feedbackForm.js)
  upload: () => [
    { d: 'M12 3v12' },
    { d: 'm17 8-5-5-5 5' },
    { d: 'M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4' }
  ],
  // lucide: save — backup reminder banner (backupReminderBanner.js)
  save: () => [
    { d: 'M15.2 3a2 2 0 0 1 1.4.6l3.8 3.8a2 2 0 0 1 .6 1.4V19a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2z' },
    { d: 'M17 21v-7a1 1 0 0 0-1-1H8a1 1 0 0 0-1 1v7' },
    { d: 'M7 3v4a1 1 0 0 0 1 1h7' }
  ],
  // lucide: star — favorite-roadmap toggle on the onboarding picker (issue #177);
  // filled/unfilled favorite state is a CSS color change on the button, not two shapes.
  star: () => [
    { d: 'M11.525 2.295a.53.53 0 0 1 .95 0l2.31 4.679a2.123 2.123 0 0 0 1.595 1.16l5.166.756a.53.53 0 0 1 .294.904l-3.736 3.638a2.123 2.123 0 0 0-.611 1.878l.882 5.14a.53.53 0 0 1-.771.56l-4.618-2.428a2.122 2.122 0 0 0-1.973 0L6.396 21.01a.53.53 0 0 1-.77-.56l.881-5.139a2.122 2.122 0 0 0-.611-1.879L2.16 9.795a.53.53 0 0 1 .294-.906l5.165-.755a2.122 2.122 0 0 0 1.597-1.16z' }
  ],
  // lucide: play — time-tracking start control (itemPanel.js, dailyTodoPanel.js — issue #180)
  play: () => [
    { d: 'M5 5a2 2 0 0 1 3.008-1.728l11.997 6.998a2 2 0 0 1 .003 3.458l-12 7A2 2 0 0 1 5 19z' }
  ],
  // lucide: pause
  pause: () => [
    { tag: 'rect', x: '14', y: '3', width: '5', height: '18', rx: '1' },
    { tag: 'rect', x: '5', y: '3', width: '5', height: '18', rx: '1' }
  ],
  // lucide: more-horizontal — card-action overflow trigger (issue #206 §4.1)
  overflow: () => [
    { tag: 'circle', cx: '12', cy: '12', r: '1' },
    { tag: 'circle', cx: '19', cy: '12', r: '1' },
    { tag: 'circle', cx: '5', cy: '12', r: '1' }
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
