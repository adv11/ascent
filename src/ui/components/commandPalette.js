import { el } from '../dom.js';
import { openModal } from './modal.js';

// Simple subsequence-based fuzzy match (no dependency) — every character of
// `query` must appear in `target`, in order, case-insensitively. Score
// rewards matches where the query's characters sit closer together (a tight
// contiguous match like "oop" in "OOP" scores far higher than the same
// letters scattered across a long, unrelated string), same intuition classic
// fuzzy-finders (fzf, VS Code's Quick Open) use without needing their full
// algorithm here.
export function fuzzyMatch(query, target) {
  const q = query.toLowerCase();
  const t = target.toLowerCase();
  if (!q) return { matched: true, score: 0 };
  let ti = 0;
  let firstIndex = -1;
  let lastIndex = -1;
  for (let qi = 0; qi < q.length; qi++) {
    const found = t.indexOf(q[qi], ti);
    if (found === -1) return { matched: false, score: -Infinity };
    if (firstIndex === -1) firstIndex = found;
    lastIndex = found;
    ti = found + 1;
  }
  const span = lastIndex - firstIndex + 1;
  const score = 100 - span;
  return { matched: true, score };
}

// Issue #6 Phase 3.3 — a generic searchable command palette. `items`:
// [{ id, title, subtitle, onSelect }]. Wired into topbar.js (Cmd/Ctrl+K,
// issue #125) with page-navigation items.
//
// Issue #283 — an optional second search mode, layered on top of the nav-item
// filter above rather than replacing it: `crossRoadmapSearch: { minQueryLength,
// search(query) => Promise<[{ id, title, subtitle, onSelect }]> }`. Once the typed
// query reaches `minQueryLength`, `search()` is called (topbar.js wires this to
// roadmapStore.js's getAllRoadmapsForSearch() + core/roadmap/globalTopicSearch.js's
// pure matcher) and its results render as a second, labeled group below the nav
// results — this component stays roadmap-agnostic; it only ever renders whatever
// `{ title, subtitle, onSelect }` rows the caller hands it, same contract as the
// plain `items` list already had.
export function openCommandPalette(items, { placeholder = 'Search…', crossRoadmapSearch } = {}) {
  const listId = 'command-palette-list';
  const input = el('input', {
    className: 'command-palette-input',
    type: 'text',
    placeholder,
    'aria-label': placeholder,
    // Issue #6 Phase 9 — WAI-ARIA combobox pattern: the input owns the
    // listbox via aria-controls and announces the currently-active option
    // via aria-activedescendant (updated in render() below), rather than
    // moving DOM focus onto each option as arrow keys are pressed.
    role: 'combobox',
    'aria-expanded': 'true',
    'aria-controls': listId,
    'aria-autocomplete': 'list'
  });
  const list = el('div', { className: 'command-palette-list', role: 'listbox', id: listId });
  let navFiltered = items;
  let topicFiltered = [];
  let filtered = items;
  let activeIndex = 0;
  // Guards against an older, slower crossRoadmapSearch() call resolving after a
  // newer one already started — same "stateCallId" precedent roadmapStore.js's own
  // setUser()/switchRoadmap() use for exactly this async-out-of-order shape.
  let searchToken = 0;

  function optionId(i) { return `command-palette-option-${i}`; }

  // Rebuilds the single flat, keyboard-navigable `filtered` list from the two
  // group arrays — nav results first, then topic results — so activeIndex/select()
  // never need to know which group an index falls into.
  function recomputeFiltered() {
    filtered = [...navFiltered, ...topicFiltered];
    activeIndex = Math.min(activeIndex, Math.max(filtered.length - 1, 0));
  }

  // A group header is only rendered when both groups can legitimately appear at
  // once (crossRoadmapSearch is configured) — a plain nav-only palette (every
  // existing call site until topbar.js's own topic-search wiring) renders exactly
  // as it did before this issue, no headers at all.
  function buildGroupHeader(text) {
    return el('div', { className: 'command-palette-group-label', text });
  }

  function buildOptionRow(item, i) {
    return el('button', {
      type: 'button',
      role: 'option',
      id: optionId(i),
      className: `command-palette-item${i === activeIndex ? ' active' : ''}`,
      'aria-selected': String(i === activeIndex),
      onClick: () => select(i)
    }, [
      el('span', { className: 'command-palette-item-title', text: item.title }),
      item.subtitle ? el('span', { className: 'command-palette-item-subtitle', text: item.subtitle }) : null
    ].filter(Boolean));
  }

  function render() {
    const rows = [];
    // "Topics" only appears once there are real topic results (below
    // minQueryLength, or before an async search() resolves, topicFiltered is
    // always empty — no header, no visual change from a plain nav-only palette).
    // "Navigation" only appears *alongside* a non-empty Topics group, to
    // disambiguate the two — a nav-only palette (every call site until this
    // issue) never shows a "Navigation" label of its own.
    const showTopicsHeader = topicFiltered.length > 0;
    const showNavHeader = showTopicsHeader && navFiltered.length > 0;
    if (showNavHeader) rows.push(buildGroupHeader('Navigation'));
    navFiltered.forEach((item, i) => rows.push(buildOptionRow(item, i)));
    if (showTopicsHeader) rows.push(buildGroupHeader('Topics'));
    topicFiltered.forEach((item, i) => rows.push(buildOptionRow(item, navFiltered.length + i)));
    list.replaceChildren(...rows);
    input.setAttribute('aria-activedescendant', filtered.length ? optionId(activeIndex) : '');
  }

  function select(i) {
    const item = filtered[i];
    if (!item) return;
    modal.close();
    item.onSelect?.();
  }

  function filterNavItems(query) {
    navFiltered = items
      .map(item => ({ item, match: fuzzyMatch(query, `${item.title} ${item.subtitle || ''}`) }))
      .filter(({ match }) => match.matched)
      .sort((a, b) => b.match.score - a.match.score)
      .map(({ item }) => item);
  }

  async function runCrossRoadmapSearch(query, token) {
    const minLength = crossRoadmapSearch.minQueryLength ?? 2;
    if (query.trim().length < minLength) {
      topicFiltered = [];
      recomputeFiltered();
      render();
      return;
    }
    let results;
    try {
      results = await crossRoadmapSearch.search(query);
    } catch (error) {
      console.error('Cross-roadmap topic search failed', error);
      results = [];
    }
    if (token !== searchToken) return; // a newer keystroke already superseded this call
    topicFiltered = results || [];
    recomputeFiltered();
    render();
  }

  function filterItems(query) {
    filterNavItems(query);
    activeIndex = 0;
    recomputeFiltered();
    render();
    if (crossRoadmapSearch) {
      searchToken += 1;
      runCrossRoadmapSearch(query, searchToken);
    }
  }

  input.addEventListener('input', () => filterItems(input.value));

  input.addEventListener('keydown', e => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      activeIndex = Math.min(activeIndex + 1, filtered.length - 1);
      render();
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      activeIndex = Math.max(activeIndex - 1, 0);
      render();
    } else if (e.key === 'Enter') {
      e.preventDefault();
      select(activeIndex);
    }
  });

  render();

  const modal = openModal({
    ariaLabel: 'Command palette',
    className: 'command-palette-card',
    content: [
      input,
      list,
      el('div', { className: 'command-palette-footer', text: 'Enter to select · Esc to close' })
    ]
  });

  input.focus();
  return modal;
}

// Wires Cmd+K (Mac) / Ctrl+K (other platforms) to call `onOpen`. Returns an
// unsubscribe function — callers (a future page/main.js wiring) must call it
// on teardown, same "always pair a subscription with cleanup" convention as
// everything else in this codebase.
export function bindCommandPaletteShortcut(onOpen) {
  function onKeydown(e) {
    if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
      e.preventDefault();
      onOpen();
    }
  }
  window.addEventListener('keydown', onKeydown);
  return () => window.removeEventListener('keydown', onKeydown);
}
