import { svgIcon } from '../utils/svg.js';

// Decorative, data-driven icon set (issue #136 Phase 2), migrated from
// Phosphor Icons' Duotone weight to real Lucide source paths in issue #301
// (Phase 5 of the v2 "Modernist" redesign) — covers every template icon
// (src/data/templates/index.js), resource-type badge
// (src/ui/utils/linkDetector.js's LINK_TYPE_META), custom-roadmap card icon
// (src/ui/utils/customRoadmapIcon.js), and feedback-type category card
// (feedbackModal.js/feedbackWidget.js/myReports.js). Replaces the raw
// Unicode/emoji glyphs those modules used to hold directly (issue #136) and,
// as of this migration, the Phosphor Duotone two-tone treatment that used to
// visually distinguish decorative content from createIcon()'s flat chrome —
// design-system.md §5 specifies one single icon vocabulary app-wide ("Icons:
// Lucide only... No emoji, no Phosphor Duotone"), so decorative and
// functional icons now share the exact same rendering style; the split
// between this module and icons.js remains purely about *content*
// (decorative/data-driven vs. functional/navigational), not visual weight.
//
// Each entry is one or more Lucide shape descriptors — `{ tag?, ...svgAttrs }`
// lifted verbatim from Lucide's own 24x24-viewBox SVG source (lucide-static,
// ISC licensed) — rendered through the same shared `svgIcon()` stroke-icon
// defaults `createIcon()` (icons.js) uses. Several resource-type entries below
// (youtube, github, notion, google-doc, google-drive, medium, stackoverflow)
// stand in for a real brand mark: Lucide deliberately ships no brand/company
// logos (unlike Phosphor, which had e.g. a literal "youtube-logo" glyph), so
// each maps onto the closest generic semantic equivalent instead (a video
// frame for YouTube, a code bracket for GitHub, a cloud for Google Drive,
// etc.) — a deliberate, documented substitution, not an oversight.
const DECORATIVE_ICON_SHAPES = {
  // Template icons (src/data/templates/index.js)
  // lucide: server
  'java-backend': () => [
    { tag: 'line', x1: '6', x2: '6.01', y1: '6', y2: '6' },
    { tag: 'line', x1: '6', x2: '6.01', y1: '18', y2: '18' },
    { tag: 'rect', width: '20', height: '8', x: '2', y: '2', rx: '2', ry: '2' },
    { tag: 'rect', width: '20', height: '8', x: '2', y: '14', rx: '2', ry: '2' }
  ],
  // lucide: bot
  'genai-agentic-ai': () => [
    { d: 'M12 8V4H8' },
    { d: 'M2 14h2' },
    { d: 'M20 14h2' },
    { d: 'M15 13v2' },
    { d: 'M9 13v2' },
    { tag: 'rect', width: '16', height: '12', x: '4', y: '8', rx: '2' }
  ],
  // lucide: layout-template
  frontend: () => [
    { tag: 'rect', width: '18', height: '7', x: '3', y: '3', rx: '1' },
    { tag: 'rect', width: '9', height: '7', x: '3', y: '14', rx: '1' },
    { tag: 'rect', width: '5', height: '7', x: '16', y: '14', rx: '1' }
  ],
  // lucide: database
  'data-science': () => [
    { d: 'M3 5V19A9 3 0 0 0 21 19V5' },
    { d: 'M3 12A9 3 0 0 0 21 12' },
    { tag: 'ellipse', cx: '12', cy: '5', rx: '9', ry: '3' }
  ],
  // lucide: calculator
  'math-grade12': () => [
    { d: 'M16 10h.01' },
    { d: 'M12 10h.01' },
    { d: 'M8 10h.01' },
    { d: 'M12 14h.01' },
    { d: 'M8 14h.01' },
    { d: 'M12 18h.01' },
    { d: 'M8 18h.01' },
    { tag: 'line', x1: '8', x2: '16', y1: '6', y2: '6' },
    { tag: 'line', x1: '16', x2: '16', y1: '14', y2: '18' },
    { tag: 'rect', width: '16', height: '20', x: '4', y: '2', rx: '2' }
  ],
  // lucide: music
  piano: () => [
    { d: 'M9 18V5l12-2v13' },
    { tag: 'circle', cx: '6', cy: '18', r: '3' },
    { tag: 'circle', cx: '18', cy: '16', r: '3' }
  ],
  // lucide: megaphone
  marketing: () => [
    { d: 'M11 6a13 13 0 0 0 8.4-2.8A1 1 0 0 1 21 4v12a1 1 0 0 1-1.6.8A13 13 0 0 0 11 14H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2z' },
    { d: 'M6 14a12 12 0 0 0 2.4 7.2 2 2 0 0 0 3.2-2.4A8 8 0 0 1 10 14' },
    { d: 'M8 6v8' }
  ],
  // Resource-type icons (src/ui/utils/linkDetector.js's LINK_TYPE_META) —
  // see the file header for why these are generic stand-ins, not real logos.
  // lucide: video
  youtube: () => [
    { d: 'm16 13 5.223 3.482a.5.5 0 0 0 .777-.416V7.87a.5.5 0 0 0-.752-.432L16 10.5' },
    { tag: 'rect', x: '2', y: '6', width: '14', height: '12', rx: '2' }
  ],
  // lucide: code-2
  github: () => [
    { d: 'm18 16 4-4-4-4' },
    { d: 'm6 8-4 4 4 4' },
    { d: 'm14.5 4-5 16' }
  ],
  // lucide: sticky-note
  notion: () => [
    { d: 'M21 9a2.4 2.4 0 0 0-.706-1.706l-3.588-3.588A2.4 2.4 0 0 0 15 3H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2z' },
    { d: 'M15 3v5a1 1 0 0 0 1 1h5' }
  ],
  // lucide: file-text
  'google-doc': () => [
    { d: 'M6 22a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h8a2.4 2.4 0 0 1 1.704.706l3.588 3.588A2.4 2.4 0 0 1 20 8v12a2 2 0 0 1-2 2z' },
    { d: 'M14 2v5a1 1 0 0 0 1 1h5' },
    { d: 'M10 9H8' },
    { d: 'M16 13H8' },
    { d: 'M16 17H8' }
  ],
  // lucide: cloud
  'google-drive': () => [
    { d: 'M17.5 19H9a7 7 0 1 1 6.71-9h1.79a4.5 4.5 0 1 1 0 9Z' }
  ],
  // lucide: pen-line
  medium: () => [
    { d: 'M13 21h8' },
    { d: 'M21.174 6.812a1 1 0 0 0-3.986-3.987L3.842 16.174a2 2 0 0 0-.5.83l-1.321 4.352a.5.5 0 0 0 .623.622l4.353-1.32a2 2 0 0 0 .83-.497z' }
  ],
  // lucide: message-square-code
  stackoverflow: () => [
    { d: 'M22 17a2 2 0 0 1-2 2H6.828a2 2 0 0 0-1.414.586l-2.202 2.202A.71.71 0 0 1 2 21.286V5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2z' },
    { d: 'm10 8-3 3 3 3' },
    { d: 'm14 14 3-3-3-3' }
  ],
  // lucide: newspaper
  article: () => [
    { d: 'M15 18h-5' },
    { d: 'M18 14h-8' },
    { d: 'M4 22h16a2 2 0 0 0 2-2V4a2 2 0 0 0-2-2H8a2 2 0 0 0-2 2v16a2 2 0 0 1-4 0v-9a2 2 0 0 1 2-2h2' },
    { tag: 'rect', width: '8', height: '4', x: '10', y: '6', rx: '1' }
  ],
  // Custom/imported roadmap card icons (src/ui/utils/customRoadmapIcon.js,
  // issue #61 follow-up) — a curated 16-icon rotation, deterministically
  // hash-picked per roadmap id. Sit in the same onboarding-grid card row as
  // the template icons above, so every card in that grid draws from this one
  // set. lucide: book
  book: () => [
    { d: 'M4 19.5v-15A2.5 2.5 0 0 1 6.5 2H19a1 1 0 0 1 1 1v18a1 1 0 0 1-1 1H6.5a1 1 0 0 1 0-5H20' }
  ],
  // lucide: book-open
  'book-open': () => [
    { d: 'M12 7v14' },
    { d: 'M3 18a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1h5a4 4 0 0 1 4 4 4 4 0 0 1 4-4h5a1 1 0 0 1 1 1v13a1 1 0 0 1-1 1h-6a3 3 0 0 0-3 3 3 3 0 0 0-3-3z' }
  ],
  // lucide: notebook
  notebook: () => [
    { d: 'M2 6h4' },
    { d: 'M2 10h4' },
    { d: 'M2 14h4' },
    { d: 'M2 18h4' },
    { d: 'M16 2v20' },
    { tag: 'rect', width: '16', height: '20', x: '4', y: '2', rx: '2' }
  ],
  // lucide: library
  books: () => [
    { d: 'm16 6 4 14' },
    { d: 'M12 6v14' },
    { d: 'M8 8v12' },
    { d: 'M4 4v16' }
  ],
  // lucide: notebook-pen
  notepad: () => [
    { d: 'M13.4 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-7.4' },
    { d: 'M2 6h4' },
    { d: 'M2 10h4' },
    { d: 'M2 14h4' },
    { d: 'M2 18h4' },
    { d: 'M21.378 5.626a1 1 0 1 0-3.004-3.004l-5.01 5.012a2 2 0 0 0-.506.854l-.837 2.87a.5.5 0 0 0 .62.62l2.87-.837a2 2 0 0 0 .854-.506z' }
  ],
  // lucide: folders
  folders: () => [
    { d: 'M20 5a2 2 0 0 1 2 2v7a2 2 0 0 1-2 2H9a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h2.5a1.5 1.5 0 0 1 1.2.6l.6.8a1.5 1.5 0 0 0 1.2.6z' },
    { d: 'M3 8.268a2 2 0 0 0-1 1.738V19a2 2 0 0 0 2 2h11a2 2 0 0 0 1.732-1' }
  ],
  // lucide: compass
  compass: () => [
    { d: 'm16.24 7.76-1.804 5.411a2 2 0 0 1-1.265 1.265L7.76 16.24l1.804-5.411a2 2 0 0 1 1.265-1.265z' },
    { tag: 'circle', cx: '12', cy: '12', r: '10' }
  ],
  // lucide: target
  target: () => [
    { tag: 'circle', cx: '12', cy: '12', r: '10' },
    { tag: 'circle', cx: '12', cy: '12', r: '6' },
    { tag: 'circle', cx: '12', cy: '12', r: '2' }
  ],
  // lucide: wrench
  wrench: () => [
    { d: 'M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.106-3.105c.32-.322.863-.22.983.218a6 6 0 0 1-8.259 7.057l-7.91 7.91a1 1 0 0 1-2.999-3l7.91-7.91a6 6 0 0 1 7.057-8.259c.438.12.54.662.219.984z' }
  ],
  // lucide: rocket
  rocket: () => [
    { d: 'M12 15v5s3.03-.55 4-2c1.08-1.62 0-5 0-5' },
    { d: 'M4.5 16.5c-1.5 1.26-2 5-2 5s3.74-.5 5-2c.71-.84.7-2.13-.09-2.91a2.18 2.18 0 0 0-2.91-.09' },
    { d: 'M9 12a22 22 0 0 1 2-3.95A12.88 12.88 0 0 1 22 2c0 2.72-.78 7.5-6 11a22.4 22.4 0 0 1-4 2z' },
    { d: 'M9 12H4s.55-3.03 2-4c1.62-1.08 5 .05 5 .05' }
  ],
  // lucide: puzzle
  'puzzle-piece': () => [
    { d: 'M15.39 4.39a1 1 0 0 0 1.68-.474 2.5 2.5 0 1 1 3.014 3.015 1 1 0 0 0-.474 1.68l1.683 1.682a2.414 2.414 0 0 1 0 3.414L19.61 15.39a1 1 0 0 1-1.68-.474 2.5 2.5 0 1 0-3.014 3.015 1 1 0 0 1 .474 1.68l-1.683 1.682a2.414 2.414 0 0 1-3.414 0L8.61 19.61a1 1 0 0 0-1.68.474 2.5 2.5 0 1 1-3.014-3.015 1 1 0 0 0 .474-1.68l-1.683-1.682a2.414 2.414 0 0 1 0-3.414L4.39 8.61a1 1 0 0 1 1.68.474 2.5 2.5 0 1 0 3.014-3.015 1 1 0 0 1-.474-1.68l1.683-1.682a2.414 2.414 0 0 1 3.414 0z' }
  ],
  // lucide: binoculars
  binoculars: () => [
    { d: 'M10 10h4' },
    { d: 'M19 7V4a1 1 0 0 0-1-1h-2a1 1 0 0 0-1 1v3' },
    { d: 'M20 21a2 2 0 0 0 2-2v-3.851c0-1.39-2-2.962-2-4.829V8a1 1 0 0 0-1-1h-4a1 1 0 0 0-1 1v11a2 2 0 0 0 2 2z' },
    { d: 'M 22 16 L 2 16' },
    { d: 'M4 21a2 2 0 0 1-2-2v-3.851c0-1.39 2-2.962 2-4.829V8a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v11a2 2 0 0 1-2 2z' },
    { d: 'M9 7V4a1 1 0 0 0-1-1H6a1 1 0 0 0-1 1v3' }
  ],
  // lucide: brain
  brain: () => [
    { d: 'M12 18V5' },
    { d: 'M15 13a4.17 4.17 0 0 1-3-4 4.17 4.17 0 0 1-3 4' },
    { d: 'M17.598 6.5A3 3 0 1 0 12 5a3 3 0 1 0-5.598 1.5' },
    { d: 'M17.997 5.125a4 4 0 0 1 2.526 5.77' },
    { d: 'M18 18a4 4 0 0 0 2-7.464' },
    { d: 'M19.967 17.483A4 4 0 1 1 12 18a4 4 0 1 1-7.967-.517' },
    { d: 'M6 18a4 4 0 0 1-2-7.464' },
    { d: 'M6.003 5.125a4 4 0 0 0-2.526 5.77' }
  ],
  // lucide: pin
  'push-pin': () => [
    { d: 'M12 17v5' },
    { d: 'M9 10.76a2 2 0 0 1-1.11 1.79l-1.78.9A2 2 0 0 0 5 15.24V16a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1v-.76a2 2 0 0 0-1.11-1.79l-1.78-.9A2 2 0 0 1 15 10.76V7a1 1 0 0 1 1-1 2 2 0 0 0 0-4H8a2 2 0 0 0 0 4 1 1 0 0 1 1 1z' }
  ],
  // lucide: bookmark
  'bookmark-simple': () => [
    { d: 'M17 3a2 2 0 0 1 2 2v15a1 1 0 0 1-1.496.868l-4.512-2.578a2 2 0 0 0-1.984 0l-4.512 2.578A1 1 0 0 1 5 20V5a2 2 0 0 1 2-2z' }
  ],
  // lucide: map
  'map-trifold': () => [
    { d: 'M14.106 5.553a2 2 0 0 0 1.788 0l3.659-1.83A1 1 0 0 1 21 4.619v12.764a1 1 0 0 1-.553.894l-4.553 2.277a2 2 0 0 1-1.788 0l-4.212-2.106a2 2 0 0 0-1.788 0l-3.659 1.83A1 1 0 0 1 3 19.381V6.618a1 1 0 0 1 .553-.894l4.553-2.277a2 2 0 0 1 1.788 0z' },
    { d: 'M15 5.764v15' },
    { d: 'M9 3.236v15' }
  ],
  // Feedback-type category cards (feedbackModal.js/feedbackWidget.js/
  // myReports.js) — category-selection cards, same "decorative content tied
  // to data" reasoning as template icons.
  // lucide: bug
  bug: () => [
    { d: 'M12 20v-9' },
    { d: 'M14 7a4 4 0 0 1 4 4v3a6 6 0 0 1-12 0v-3a4 4 0 0 1 4-4z' },
    { d: 'M14.12 3.88 16 2' },
    { d: 'M21 21a4 4 0 0 0-3.81-4' },
    { d: 'M21 5a4 4 0 0 1-3.55 3.97' },
    { d: 'M22 13h-4' },
    { d: 'M3 21a4 4 0 0 1 3.81-4' },
    { d: 'M3 5a4 4 0 0 0 3.55 3.97' },
    { d: 'M6 13H2' },
    { d: 'm8 2 1.88 1.88' },
    { d: 'M9 7.13V6a3 3 0 1 1 6 0v1.13' }
  ],
  // lucide: lightbulb
  lightbulb: () => [
    { d: 'M15 14c.2-1 .7-1.7 1.5-2.5 1-.9 1.5-2.2 1.5-3.5A6 6 0 0 0 6 8c0 1 .2 2.2 1.5 3.5.7.7 1.3 1.5 1.5 2.5' },
    { d: 'M9 18h6' },
    { d: 'M10 22h4' }
  ],
  // lucide: message-circle
  'chat-circle': () => [
    { d: 'M2.992 16.342a2 2 0 0 1 .094 1.167l-1.065 3.29a1 1 0 0 0 1.236 1.168l3.413-.998a2 2 0 0 1 1.099.092 10 10 0 1 0-4.777-4.719' }
  ]
};

const VALID_SIZES = new Set(['xs', 'sm', 'md', 'lg']);

// Same size-token contract as createIcon() (icons.js) — never an inline
// style, always one of the --icon-size-* modifier classes.
export function createDecorativeIcon(name, { size = 'lg' } = {}) {
  const shapes = DECORATIVE_ICON_SHAPES[name];
  if (!shapes) throw new Error(`Unknown decorative icon: "${name}"`);
  if (!VALID_SIZES.has(size)) throw new Error(`Unknown icon size: "${size}"`);
  const svg = svgIcon(shapes());
  svg.setAttribute('class', `icon icon-${size}`);
  return svg;
}

export function hasDecorativeIcon(name) {
  return name in DECORATIVE_ICON_SHAPES;
}
