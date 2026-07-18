import { el, isValidUrl } from '../dom.js';
import { createBrandMark } from '../components/brand.js';
import { createIcon } from '../components/icons.js';
import { getSharedRoadmap } from '../../services/shareStore.js';

// Read-only, unauthenticated view for a published roadmap snapshot (issue
// #131) — route: '#/shared?id=<shareId>'. Deliberately not gated behind
// guardApp/main.js's auth flow: this is the one page a signed-out visitor
// can view real (someone else's) roadmap content on, by design.

function getShareIdFromRoute() {
  const [, query = ''] = window.location.hash.replace(/^#/, '').split('?');
  return new URLSearchParams(query).get('id');
}

function renderRevoked() {
  return el('div', { className: 'shared-view-state' }, [
    el('h1', { text: 'This link has been revoked.' }),
    el('p', { text: 'The person who shared this roadmap has removed it, or the link never existed.' }),
    el('a', { href: '#/', className: 'btn btn-primary', text: 'Go to Ascent' })
  ]);
}

function renderResource(resource) {
  const href = isValidUrl(resource.url) ? resource.url : '#';
  return el('a', {
    className: 'shared-resource-link',
    href,
    target: '_blank',
    rel: 'noopener noreferrer',
    text: resource.label || resource.url,
    onClick: e => { if (href === '#') e.preventDefault(); }
  });
}

function renderItem(item) {
  return el('li', { className: `shared-item${item.done ? ' shared-item-done' : ''}` }, [
    el('span', { className: 'shared-item-status', 'aria-hidden': 'true' }, item.done ? [createIcon('check', { size: 'xs' })] : []),
    el('span', { className: 'shared-item-title', text: item.title }),
    el('span', { className: `priority-tag ${item.priority || ''}`, text: item.priority || '' }),
    ...(item.resources && item.resources.length
      ? [el('div', { className: 'shared-item-resources' }, item.resources.map(renderResource))]
      : [])
  ]);
}

function groupItemsByPhaseSection(phases, items) {
  const itemList = Object.values(items || {});
  return (phases || []).map(phase => ({
    phase,
    sections: (phase.sections || []).map(section => ({
      section,
      items: itemList.filter(item => item.phase === phase.title && item.section === section.title)
    }))
  }));
}

function renderSnapshot(snapshot) {
  const grouped = groupItemsByPhaseSection(snapshot.phases, snapshot.items);
  return el('div', { className: 'shared-view' }, [
    el('header', { className: 'shared-view-header' }, [
      el('h1', { text: snapshot.title }),
      el('p', { className: 'shared-view-subtitle', text: 'A read-only, shared roadmap snapshot.' })
    ]),
    el('div', { className: 'shared-view-phases' }, grouped.map(({ phase, sections }) =>
      el('section', { className: 'shared-phase-card' }, [
        el('h2', { text: phase.title }),
        ...sections.map(({ section, items }) =>
          el('div', { className: 'shared-section' }, [
            el('h3', { text: section.title }),
            el('ul', { className: 'shared-item-list' }, items.map(renderItem))
          ])
        )
      ])
    )),
    el('footer', { className: 'shared-view-footer' }, [
      el('a', { href: '#/', className: 'shared-view-attribution' }, [
        ...createBrandMark(),
        el('span', { text: ' — Made with Ascent' })
      ])
    ])
  ]);
}

export function renderSharedRoadmapView(app) {
  // fade-in (issue #206 §5) — same route-transition coverage every other
  // page's outermost container already has; see landing.js's identical note.
  const container = el('div', { className: 'shared-view-container fade-in' }, [
    el('p', { className: 'shared-view-loading', text: 'Loading roadmap…' })
  ]);
  app.replaceChildren(container);

  const shareId = getShareIdFromRoute();
  let cancelled = false;

  (async () => {
    const snapshot = shareId ? await getSharedRoadmap(shareId).catch(() => null) : null;
    if (cancelled) return;
    container.replaceChildren(snapshot ? renderSnapshot(snapshot) : renderRevoked());
  })();

  return () => { cancelled = true; };
}
