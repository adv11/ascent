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
// issue #125) with page-navigation items only; searching live roadmap
// items/sections/phases (the original spec's fuller ambition) is real
// feature work for its own follow-up issue, deliberately out of scope there
// — `openCommandPalette` here stays the reusable primitive any future caller
// hands its own item list to.
export function openCommandPalette(items, { placeholder = 'Search…' } = {}) {
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
  let filtered = items;
  let activeIndex = 0;

  function optionId(i) { return `command-palette-option-${i}`; }

  function render() {
    list.replaceChildren(...filtered.map((item, i) => el('button', {
      type: 'button',
      role: 'option',
      id: optionId(i),
      className: `command-palette-item${i === activeIndex ? ' active' : ''}`,
      'aria-selected': String(i === activeIndex),
      onClick: () => select(i)
    }, [
      el('span', { className: 'command-palette-item-title', text: item.title }),
      item.subtitle ? el('span', { className: 'command-palette-item-subtitle', text: item.subtitle }) : null
    ].filter(Boolean))));
    input.setAttribute('aria-activedescendant', filtered.length ? optionId(activeIndex) : '');
  }

  function select(i) {
    const item = filtered[i];
    if (!item) return;
    modal.close();
    item.onSelect?.();
  }

  function filterItems(query) {
    filtered = items
      .map(item => ({ item, match: fuzzyMatch(query, `${item.title} ${item.subtitle || ''}`) }))
      .filter(({ match }) => match.matched)
      .sort((a, b) => b.match.score - a.match.score)
      .map(({ item }) => item);
    activeIndex = 0;
    render();
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
