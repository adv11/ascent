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
  // lucide: filter — issue #505, the "no topics match those filters" empty state
  filter: () => [
    { tag: 'polygon', points: '22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3' }
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
  ],
  // lucide: lock — issue #381, "blocked by an unmet prerequisite" chip
  lock: () => [
    { tag: 'rect', width: '18', height: '11', x: '3', y: '11', rx: '2', ry: '2' },
    { d: 'M7 11V7a5 5 0 0 1 10 0v4' }
  ],
  // lucide: arrow-up-right — the "opens externally" affordance on the
  // developer profile page's link cards (issue #506).
  arrowUpRight: () => [
    { d: 'M7 7h10v10' },
    { d: 'M7 17 17 7' }
  ],
  // Brand marks (issue #414, developer profile page §5 rule) — fill: currentColor,
  // no stroke, per design-system.md §5's "brand marks use fill, everything else
  // uses stroke-2" split. Never apply this fill treatment to a non-brand-mark icon.
  github: () => [
    { d: 'M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0 0 24 12c0-6.63-5.37-12-12-12z', fill: 'currentColor', stroke: 'none' }
  ],
  linkedin: () => [
    { d: 'M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433c-1.144 0-2.063-.926-2.063-2.065 0-1.138.92-2.063 2.063-2.063 1.14 0 2.064.925 2.064 2.063 0 1.139-.925 2.065-2.064 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z', fill: 'currentColor', stroke: 'none' }
  ],
  x: () => [
    { d: 'M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z', fill: 'currentColor', stroke: 'none' }
  ],
  // Simple Icons "leetcode" path, sourced verbatim — new for issue #414's
  // developer profile page, same brand-mark fill treatment as github/
  // linkedin/x above (design-system.md §5).
  leetcode: () => [
    { d: 'M13.483 0a1.374 1.374 0 0 0-.961.438L7.116 6.226l-3.854 4.126a5.266 5.266 0 0 0-1.209 2.104 5.35 5.35 0 0 0-.125.513 5.527 5.527 0 0 0 .062 2.362 5.83 5.83 0 0 0 .349 1.017 5.938 5.938 0 0 0 1.271 1.818l4.277 4.193.039.038c2.248 2.165 5.852 2.133 8.063-.074l2.396-2.392c.54-.54.54-1.414.003-1.955a1.378 1.378 0 0 0-1.951-.003l-2.396 2.392a3.021 3.021 0 0 1-4.205.038l-.02-.019-4.276-4.193c-.652-.64-.972-1.469-.948-2.263a2.68 2.68 0 0 1 .066-.523 2.545 2.545 0 0 1 .619-1.164L9.13 8.114c1.058-1.134 3.204-1.27 4.43-.278l3.501 2.831c.593.48 1.461.387 1.94-.207a1.384 1.384 0 0 0-.207-1.943l-3.5-2.831c-.8-.647-1.766-1.045-2.774-1.202l2.015-2.158A1.384 1.384 0 0 0 13.483 0zm-2.866 12.815a1.38 1.38 0 0 0-1.38 1.382 1.38 1.38 0 0 0 1.38 1.382H20.79a1.38 1.38 0 0 0 1.38-1.382 1.38 1.38 0 0 0-1.38-1.382z', fill: 'currentColor', stroke: 'none' }
  ],
  // lucide: mail — new for issue #414, same stroke-2 line-icon treatment as
  // every other non-brand-mark icon in this set.
  mail: () => [
    { tag: 'rect', width: '20', height: '16', x: '2', y: '4', rx: '2' },
    { d: 'm22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7' }
  ],
  // lucide: globe — the "Portfolio" link on the developer profile page.
  globe: () => [
    { tag: 'circle', cx: '12', cy: '12', r: '10' },
    { d: 'M12 2a14.5 14.5 0 0 0 0 20 14.5 14.5 0 0 0 0-20' },
    { d: 'M2 12h20' }
  ],
  // Simple Icons brand marks, sourced verbatim — new for issue #501's share
  // generator "Post it" targets, same fill:'currentColor'/stroke:'none'
  // brand-mark treatment as github/linkedin/x above (design-system.md §5).
  whatsapp: () => [
    { d: 'M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 0 1-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 0 1-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 0 1 2.893 6.99c-.003 5.45-4.437 9.885-9.885 9.885M20.52 3.449C18.24 1.245 15.24 0 12.05 0 5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 0 0 5.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 0 0-3.423-8.452', fill: 'currentColor', stroke: 'none' }
  ],
  threads: () => [
    { d: 'M12.186 24h-.007c-3.581-.024-6.334-1.205-8.184-3.509C2.35 18.44 1.5 15.586 1.472 12.01v-.017c.03-3.579.879-6.43 2.525-8.482C5.845 1.205 8.6.024 12.18 0h.014c2.746.02 5.043.725 6.826 2.098 1.677 1.29 2.858 3.13 3.509 5.467l-2.04.569c-1.104-3.96-3.898-5.984-8.304-6.015-2.91.022-5.11.936-6.54 2.717C4.307 6.404 3.616 8.836 3.589 12c.027 3.164.718 5.596 2.056 7.164 1.43 1.781 3.63 2.695 6.54 2.717 2.623-.02 4.358-.631 5.8-2.045 1.647-1.613 1.618-3.593 1.086-4.795-.31-.705-.874-1.29-1.634-1.72-.192 1.352-.622 2.446-1.284 3.259-.886 1.09-2.14 1.685-3.732 1.774-1.211.068-2.375-.212-3.276-.789-1.06-.679-1.687-1.746-1.766-3.007-.078-1.23.35-2.36 1.203-3.181.816-.784 1.972-1.245 3.348-1.334 1.036-.067 2.006.02 2.881.257-.116-.703-.352-1.257-.702-1.646-.483-.538-1.233-.812-2.226-.812h-.037c-.798.008-1.885.222-2.577 1.267l-1.729-1.176c.928-1.383 2.416-2.144 4.313-2.16h.048c1.556 0 2.803.457 3.706 1.36.803.802 1.315 1.906 1.523 3.283.156.032.312.067.466.106 2.075.535 3.586 1.694 4.372 3.352.898 1.9.976 4.867-1.435 7.244-1.874 1.837-4.14 2.657-7.36 2.679zm1.53-11.83c-.146-.006-.296-.006-.448.003-1.61.095-2.605.879-2.55 1.998.057 1.16 1.257 1.7 2.412 1.633 1.086-.061 2.398-.517 2.623-3.17a6.618 6.618 0 0 0-2.037-.464z', fill: 'currentColor', stroke: 'none' }
  ],
  reddit: () => [
    { d: 'M12 0A12 12 0 0 0 0 12a12 12 0 0 0 12 12 12 12 0 0 0 12-12A12 12 0 0 0 12 0zm5.01 4.744c.688 0 1.25.561 1.25 1.249a1.25 1.25 0 0 1-2.498.056l-2.597-.547-.8 3.747c1.824.07 3.48.632 4.674 1.488.308-.309.73-.491 1.207-.491.968 0 1.754.786 1.754 1.754 0 .716-.435 1.333-1.01 1.614a3.111 3.111 0 0 1 .042.52c0 2.694-3.13 4.87-7.004 4.87-3.874 0-7.004-2.176-7.004-4.87 0-.183.015-.366.043-.534A1.748 1.748 0 0 1 3.53 12.53c0-.968.786-1.754 1.754-1.754.463 0 .898.196 1.207.49 1.207-.883 2.878-1.443 4.744-1.51l.885-4.15a.32.32 0 0 1 .13-.194.319.319 0 0 1 .224-.06l2.883.607a1.25 1.25 0 0 1 1.135-.727zM9.25 12a1.25 1.25 0 1 0 0 2.5 1.25 1.25 0 0 0 0-2.5zm5.5 0a1.25 1.25 0 1 0 0 2.5 1.25 1.25 0 0 0 0-2.5zm-5.466 3.99a.327.327 0 0 0-.231.094.33.33 0 0 0 0 .463c.842.842 2.484.913 2.961.913.477 0 2.105-.056 2.961-.913a.33.33 0 0 0-.463-.463c-.535.535-1.658.712-2.512.712-.855 0-1.977-.163-2.512-.712a.326.326 0 0 0-.226-.094z', fill: 'currentColor', stroke: 'none' }
  ],
  telegram: () => [
    { d: 'M11.944 0A12 12 0 0 0 0 12a12 12 0 0 0 12 12 12 12 0 0 0 12-12A12 12 0 0 0 12 0a12 12 0 0 0-.056 0zm4.962 7.224c.1-.002.321.023.465.14a.506.506 0 0 1 .171.325c.016.093.036.306.02.472-.18 1.898-.962 6.502-1.36 8.627-.168.9-.499 1.201-.82 1.23-.696.065-1.225-.46-1.9-.902-1.056-.693-1.653-1.124-2.678-1.8-1.185-.78-.417-1.21.258-1.91.177-.184 3.247-2.977 3.307-3.23.007-.032.014-.15-.056-.212s-.174-.041-.249-.024c-.106.024-1.793 1.14-5.062 3.345-.479.33-.913.49-1.302.48-.428-.008-1.252-.241-1.865-.44-.752-.245-1.349-.374-1.297-.789.027-.216.325-.437.893-.663 3.498-1.524 5.831-2.529 6.998-3.014 3.332-1.386 4.025-1.627 4.476-1.635z', fill: 'currentColor', stroke: 'none' }
  ],
  facebook: () => [
    { d: 'M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z', fill: 'currentColor', stroke: 'none' }
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
