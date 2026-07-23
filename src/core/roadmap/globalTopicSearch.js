// Cross-roadmap topic search (issue #283) — a pure function, no DOM/store/Firebase
// access, independently unit-testable. `dashboard.js`'s own per-roadmap `searchQuery`
// (around the checklist's search input) stays the fast, local filter it already is;
// this is a *separate* search over every roadmap a user has started, feeding
// `commandPalette.js`'s topic-search mode.
//
// `roadmaps`: the shape `roadmapStore.js`'s `getAllRoadmapsForSearch()` resolves —
// `[{ id, title, items }]`, where `items` is the store's own raw id-keyed item map
// (the same shape `store.getSnapshot().items` already has for the active roadmap).
// Never mutates its inputs.

// Search covers title, phase, section, notes, and resource label/url — deliberately
// wider than dashboard.js's own local search (title/phase/section only), per the
// issue's explicit ask ("search topic titles/notes/resources across all roadmaps").
// Ranked by which field matched, title first, so a title hit always outranks a
// notes/resource hit — ties keep their original (roadmap, then item-map) order.
const FIELD_PRIORITY = ['title', 'phase', 'section', 'notes', 'resources'];

// One matcher per field, in FIELD_PRIORITY order — a plain data table instead of a
// chain of `if`s, so adding a future searchable field (or tweaking one) is a
// one-line change here rather than growing matchedFields()'s own complexity further
// (root CLAUDE.md's ESLint complexity gate).
const FIELD_MATCHERS = [
  ['title', (item, q) => item.title?.toLowerCase().includes(q)],
  ['phase', (item, q) => item.phase?.toLowerCase().includes(q)],
  ['section', (item, q) => item.section?.toLowerCase().includes(q)],
  ['notes', (item, q) => item.notes?.toLowerCase().includes(q)],
  ['resources', (item, q) => (item.resources || []).some(
    r => r.label?.toLowerCase().includes(q) || r.url?.toLowerCase().includes(q)
  )]
];

function matchedFields(item, q) {
  return FIELD_MATCHERS.filter(([, test]) => test(item, q)).map(([field]) => field);
}

function bestFieldRank(fields) {
  return Math.min(...fields.map(f => FIELD_PRIORITY.indexOf(f)));
}

// Builds one ranked match entry for a single item, or null if the item is a
// soft-deleted tombstone or doesn't match any field — extracted out of
// searchTopicsAcrossRoadmaps()'s own loop to keep that function's complexity down.
function buildMatchEntry(roadmap, item, q) {
  if (!item || item.deleted) return null;
  const fields = matchedFields(item, q);
  if (!fields.length) return null;
  return {
    rank: bestFieldRank(fields),
    match: {
      roadmapId: roadmap.id,
      roadmapTitle: roadmap.title || 'Untitled roadmap',
      itemId: item.id,
      itemTitle: item.title,
      phase: item.phase,
      section: item.section,
      matchedFields: fields
    }
  };
}

// One roadmap's worth of ranked match entries — extracted so
// searchTopicsAcrossRoadmaps() itself is just "flatten every roadmap, sort, cap",
// keeping its own complexity under the ESLint gate.
function matchRoadmapItems(roadmap, q) {
  const items = roadmap?.items || {};
  return Object.values(items)
    .map(item => buildMatchEntry(roadmap, item, q))
    .filter(Boolean);
}

// Returns matches: `{ roadmapId, roadmapTitle, itemId, itemTitle, phase, section,
// matchedFields }`, best-ranked first, capped at `limit` (default 20 — a command
// palette result list, not a full search-results page). A blank/whitespace-only
// query returns no results (matching commandPalette.js's own nav-item filter, which
// treats an empty query as "match everything" for nav but that behavior doesn't make
// sense for a global topic scan across every roadmap — an empty query would just
// dump every topic the user has ever created).
export function searchTopicsAcrossRoadmaps(roadmaps, query, { limit = 20 } = {}) {
  const q = (query || '').trim().toLowerCase();
  if (!q) return [];

  const ranked = (roadmaps || []).flatMap(roadmap => matchRoadmapItems(roadmap, q));
  ranked.sort((a, b) => a.rank - b.rank);
  return ranked.slice(0, limit).map(entry => entry.match);
}
