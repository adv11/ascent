import { el } from '../dom.js';
import { createBrandMark } from './brand.js';
import { TEMPLATES } from '../../data/templates/index.js';

const SVG_NS = 'http://www.w3.org/2000/svg';

// Local svgEl helper — same "one small helper per file that needs it" pattern
// brand.js and progressRing.js already use, rather than a shared module for
// three call sites total.
function svgEl(tag, attrs = {}) {
  const node = document.createElementNS(SVG_NS, tag);
  Object.entries(attrs).forEach(([key, value]) => node.setAttribute(key, value));
  return node;
}

function iconSvg(shapes) {
  const svg = svgEl('svg', { viewBox: '0 0 24 24', width: '22', height: '22', 'aria-hidden': 'true', focusable: 'false' });
  shapes.forEach(({ tag = 'path', ...attrs }) => svg.append(svgEl(tag, attrs)));
  return svg;
}

// Issue #6 Phase 5 follow-up — minimal line icons (Feather/Lucide-style,
// currentColor strokes) replacing the original plain-emoji glyphs, which
// render inconsistently across OS/browser combinations and read as a
// placeholder rather than a finished product on this panel specifically —
// the one surface on the whole site whose entire job is to make a strong
// first impression. Every other emoji-glyph usage across the app (filter
// chips, badges, template icons) is unaffected; this is scoped to the
// marketing panel, the same surface the brand mark's own custom SVG
// already sets the bar for.
const ICONS = {
  track: () => iconSvg([
    { tag: 'rect', x: '4', y: '4', width: '16', height: '16', rx: '5', fill: 'none', stroke: 'currentColor', 'stroke-width': '1.8' },
    { d: 'M8 12.5l2.5 2.5L16.5 9', fill: 'none', stroke: 'currentColor', 'stroke-width': '1.8', 'stroke-linecap': 'round', 'stroke-linejoin': 'round' }
  ]),
  sync: () => iconSvg([
    { d: 'M4 12a8 8 0 0 1 13.66-5.66M20 5v4.5h-4.5', fill: 'none', stroke: 'currentColor', 'stroke-width': '1.8', 'stroke-linecap': 'round', 'stroke-linejoin': 'round' },
    { d: 'M20 12a8 8 0 0 1-13.66 5.66M4 19v-4.5h4.5', fill: 'none', stroke: 'currentColor', 'stroke-width': '1.8', 'stroke-linecap': 'round', 'stroke-linejoin': 'round' }
  ]),
  focus: () => iconSvg([
    { tag: 'circle', cx: '12', cy: '12', r: '8', fill: 'none', stroke: 'currentColor', 'stroke-width': '1.8' },
    { tag: 'circle', cx: '12', cy: '12', r: '4', fill: 'none', stroke: 'currentColor', 'stroke-width': '1.8' },
    { tag: 'circle', cx: '12', cy: '12', r: '1.1', fill: 'currentColor' }
  ])
};

// Every value prop names a real, already-shipped feature — no fabricated
// testimonial/quote (the original spec's mockup had one; decided against it
// since a fake customer quote reads as deceptive on a real product once
// actual users see it). The headline below reuses Ascent's actual product
// tagline (also in index.html's meta description) instead — a real "quote"
// from the product itself, not an invented customer.
const VALUE_PROPS = [
  { icon: ICONS.track, title: 'Track any roadmap', text: 'Pick a starter template or build your own, organized by phase and priority.' },
  { icon: ICONS.sync, title: 'Sync everywhere', text: 'Your progress follows you across every device, automatically.' },
  { icon: ICONS.focus, title: 'Stay focused', text: 'Priority filters and Daily Todos keep today’s work front and center.' }
];

export function createAuthMarketingPanel() {
  return el('aside', { className: 'auth-marketing', 'aria-hidden': 'true' }, [
    el('div', { className: 'auth-marketing-bg-pattern' }),
    el('div', { className: 'auth-marketing-inner' }, [
      el('span', { className: 'brand auth-marketing-brand' }, createBrandMark()),
      el('div', { className: 'auth-marketing-content' }, [
        el('h2', { className: 'auth-marketing-headline', text: 'Engineer your next move.' }),
        el('p', { className: 'auth-marketing-subhead', text: 'The roadmap tracker for anyone learning, revising, or leveling up — pick a starting point, track every topic, and always know what’s next.' }),
        el('ul', { className: 'auth-marketing-values' }, VALUE_PROPS.map(v => el('li', { className: 'auth-marketing-value' }, [
          el('span', { className: 'auth-marketing-value-icon', 'aria-hidden': 'true' }, [v.icon()]),
          el('div', {}, [
            el('span', { className: 'auth-marketing-value-title', text: v.title }),
            el('span', { className: 'auth-marketing-value-text', text: v.text })
          ])
        ])))
      ]),
      // Real, derived from the template registry — never a hardcoded number
      // that could drift out of sync with TEMPLATES itself.
      el('p', { className: 'auth-marketing-stat', text: `${TEMPLATES.length} starter roadmaps — Java, Frontend, Data Science, GenAI, and more. Or build your own.` })
    ])
  ]);
}
