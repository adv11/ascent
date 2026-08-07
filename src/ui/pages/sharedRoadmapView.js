import { el } from '../dom.js';
import { createBrandMark, createBrandIcon } from '../components/brand.js';
import { createIcon } from '../components/icons.js';
import { createThemeToggle } from '../components/themeToggle.js';
import { createSkeletonCard, createSkeletonText } from '../components/skeleton.js';
import { priorityLabel } from '../utils/priorityLabels.js';
import { svgEl } from '../utils/svg.js';
import { getSharedRoadmap } from '../../services/shareStore.js';

// Read-only, unauthenticated view for a published roadmap snapshot (issue
// #131, restyled per issue #502's design reference —
// docs/screenshots/responsive-redesign/10-shared-roadmap.png). Deliberately
// not gated behind guardApp/main.js's auth flow: this is the one page a
// signed-out visitor can view real (someone else's) roadmap content on, by
// design. No app navigation lives on this page — nothing on it belongs to
// the visitor (issue #502's own scope note); every link here is a marketing
// entry point (home, sign up), never a link into the app shell itself.

function getShareIdFromRoute() {
  const [, query = ''] = window.location.hash.replace(/^#/, '').split('?');
  return new URLSearchParams(query).get('id');
}

function buildChrome() {
  const themeToggle = createThemeToggle();
  const header = el('header', { className: 'shared-view-chrome' }, [
    el('a', { href: '#/', className: 'brand shared-view-brand' }, createBrandMark()),
    el('div', { className: 'shared-view-chrome-actions' }, [
      themeToggle,
      el('a', { href: '#/signup', className: 'btn btn-primary btn-sm', text: 'Start free' })
    ])
  ]);
  return { header, themeToggle };
}

function renderLoading() {
  return el('div', { className: 'shared-view-loading-state' }, [
    createSkeletonText(),
    el('div', { className: 'shared-view-stats-skeleton' }, [createSkeletonCard(), createSkeletonCard()]),
    createSkeletonCard(),
    createSkeletonCard(),
    createSkeletonCard()
  ]);
}

function renderRevoked() {
  return el('div', { className: 'shared-view-state' }, [
    el('span', { className: 'shared-view-state-icon', 'aria-hidden': 'true' }, [createIcon('link', { size: 'lg' })]),
    el('h1', { text: 'This link has been revoked.' }),
    el('p', {
      className: 'shared-view-subtitle',
      text: "The roadmap's owner turned off sharing, or the link never existed. Either way, there's nothing wrong on your end."
    }),
    el('div', { className: 'shared-view-state-actions' }, [
      el('a', { href: '#/', className: 'btn btn-secondary', text: 'Go to Ascent' }),
      el('a', { href: '#/signup', className: 'btn btn-primary', text: 'Create your own roadmap' })
    ])
  ]);
}

// A horizontal progress bar whose fill width is set via a real SVG `width`
// attribute (svgEl → setAttribute), never an inline `style` — index.html's
// CSP has no unsafe-inline for style-src (.claude/rules/ui-styling.md),
// same "direct attribute mutation, not style" precedent progressRing.js's
// stroke-dashoffset already established.
function createProgressBar(percent) {
  const clamped = Math.max(0, Math.min(100, percent));
  const svg = svgEl('svg', { class: 'shared-stat-tile-bar', viewBox: '0 0 100 6', preserveAspectRatio: 'none', role: 'img', 'aria-label': `${clamped}% complete` });
  svg.append(
    svgEl('rect', { class: 'shared-stat-tile-bar-track', x: 0, y: 0, width: 100, height: 6, rx: 3 }),
    svgEl('rect', { class: 'shared-stat-tile-bar-fill', x: 0, y: 0, width: clamped, height: 6, rx: 3 })
  );
  return svg;
}

function resourceCountBadge(item) {
  const n = (item.resources || []).length;
  if (!n) return null;
  return el('span', { className: 'shared-item-resource-count' }, [createIcon('link', { size: 'xs' }), el('span', { text: String(n) })]);
}

function renderItem(item) {
  const badge = resourceCountBadge(item);
  return el('li', { className: `shared-item${item.done ? ' shared-item-done' : ''}` }, [
    el('span', { className: `shared-item-check${item.done ? ' shared-item-check-done' : ''}`, 'aria-hidden': 'true' }, item.done ? [createIcon('check', { size: 'xs' })] : []),
    el('div', { className: 'shared-item-body' }, [
      el('span', { className: 'shared-item-title', text: item.title }),
      el('span', { className: 'shared-item-priority', text: priorityLabel(item.priority) })
    ]),
    ...(badge ? [badge] : [])
  ]);
}

function computePhaseCounts(items) {
  const done = items.filter(i => i.done).length;
  return { done, total: items.length, percent: items.length ? Math.round((done / items.length) * 100) : 0 };
}

function groupItemsByPhaseSection(phases, items) {
  const itemList = Object.values(items || {});
  return (phases || []).map(phase => {
    const phaseItems = itemList.filter(item => item.phase === phase.title);
    return {
      phase,
      counts: computePhaseCounts(phaseItems),
      sections: (phase.sections || []).map(section => ({
        section,
        items: phaseItems.filter(item => item.section === section.title)
      }))
    };
  });
}

function formatPublishedDate(publishedAt) {
  if (!publishedAt) return null;
  return new Date(publishedAt).toLocaleDateString(undefined, { day: 'numeric', month: 'long', year: 'numeric' });
}

function renderStatTiles(itemList, phases) {
  const done = itemList.filter(i => i.done).length;
  const total = itemList.length;
  const percent = total ? Math.round((done / total) * 100) : 0;
  const phaseRange = phases.length > 1
    ? `${phases[0].title} through ${phases[phases.length - 1].title}`
    : (phases[0]?.title || 'No phases yet');
  return el('div', { className: 'shared-view-stats' }, [
    el('div', { className: 'card shared-stat-tile' }, [
      el('span', { className: 'shared-stat-tile-label', text: 'Progress' }),
      el('div', { className: 'shared-stat-tile-headline' }, [
        el('span', { className: 'shared-stat-tile-number', text: `${percent}%` }),
        el('span', { className: 'shared-stat-tile-sub', text: `${done} of ${total}` })
      ]),
      createProgressBar(percent)
    ]),
    el('div', { className: 'card shared-stat-tile' }, [
      el('span', { className: 'shared-stat-tile-label', text: 'Phases' }),
      el('div', { className: 'shared-stat-tile-headline' }, [
        el('span', { className: 'shared-stat-tile-number', text: String(phases.length) })
      ]),
      el('span', { className: 'shared-stat-tile-sub', text: phaseRange })
    ])
  ]);
}

function renderSnapshot(snapshot) {
  const itemList = Object.values(snapshot.items || {});
  const phases = snapshot.phases || [];
  const grouped = groupItemsByPhaseSection(phases, snapshot.items);
  const publishedDate = formatPublishedDate(snapshot.publishedAt);
  return el('div', { className: 'shared-view' }, [
    el('div', { className: 'shared-view-header' }, [
      el('span', { className: 'badge shared-view-readonly-badge' }, [createIcon('link', { size: 'xs' }), el('span', { text: 'Read-only · shared snapshot' })]),
      el('h1', { text: snapshot.title }),
      el('p', {
        className: 'shared-view-subtitle',
        text: publishedDate
          ? `Someone's roadmap, shared as it stood on ${publishedDate}. Nothing here can be changed.`
          : "Someone's roadmap. Nothing here can be changed."
      })
    ]),
    renderStatTiles(itemList, phases),
    el('div', { className: 'shared-view-phases' }, grouped.map(({ phase, counts, sections }) =>
      el('section', { className: 'card shared-phase-card' }, [
        el('div', { className: 'shared-phase-card-head' }, [
          el('div', {}, [
            el('h2', { text: phase.title }),
            el('span', { className: 'shared-phase-card-counts', text: `${counts.done} of ${counts.total} done` })
          ]),
          el('span', { className: 'shared-phase-card-percent', text: `${counts.percent}%` })
        ]),
        ...sections.map(({ section, items }) =>
          el('div', { className: 'shared-section' }, [
            el('h3', { text: section.title }),
            el('ul', { className: 'shared-item-list' }, items.map(renderItem))
          ])
        )
      ])
    )),
    el('div', { className: 'card shared-view-cta-banner' }, [
      el('div', { className: 'shared-view-cta-text' }, [
        el('h2', { text: 'Want a roadmap like this one?' }),
        el('p', { text: 'Start from the same template, free, no card needed.' })
      ]),
      el('a', { href: '#/signup', className: 'btn btn-cta-inverse', text: 'Start this roadmap' })
    ]),
    el('footer', { className: 'shared-view-footer' }, [
      el('a', { href: '#/', className: 'shared-view-attribution' }, [
        createBrandIcon(),
        el('span', { text: 'Made with Ascent' })
      ]),
      el('span', { className: 'shared-view-footer-note', text: 'Shared roadmaps are read-only and hold no personal details.' })
    ])
  ]);
}

export function renderSharedRoadmapView(app) {
  // fade-in (issue #206 §5) — same route-transition coverage every other
  // page's outermost container already has; see landing.js's identical note.
  const { header, themeToggle } = buildChrome();
  const content = el('div', { className: 'shared-view-content' }, [renderLoading()]);
  const container = el('div', { className: 'shared-view-container fade-in' }, [header, content]);
  app.replaceChildren(container);

  const shareId = getShareIdFromRoute();
  let cancelled = false;

  (async () => {
    const snapshot = shareId ? await getSharedRoadmap(shareId).catch(() => null) : null;
    if (cancelled) return;
    content.replaceChildren(snapshot ? renderSnapshot(snapshot) : renderRevoked());
  })();

  return () => {
    cancelled = true;
    themeToggle._cleanup?.();
  };
}
