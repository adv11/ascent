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
// [{ id, title, subtitle, onSelect }]. Wiring this up to actually search
// live roadmap items/sections/phases (as the original spec describes) is
// Phase 4's job once the dashboard itself is redesigned — this phase is the
// component library, not the integration; `openCommandPalette` here is the
// reusable primitive a later phase calls with real data.
export function openCommandPalette(items, { placeholder = 'Search…' } = {}) {
  const input = el('input', { className: 'command-palette-input', type: 'text', placeholder, 'aria-label': placeholder });
  const list = el('div', { className: 'command-palette-list', role: 'listbox' });
  let filtered = items;
  let activeIndex = 0;

  function render() {
    list.replaceChildren(...filtered.map((item, i) => el('button', {
      type: 'button',
      role: 'option',
      className: `command-palette-item${i === activeIndex ? ' active' : ''}`,
      'aria-selected': String(i === activeIndex),
      onClick: () => select(i)
    }, [
      el('span', { className: 'command-palette-item-title', text: item.title }),
      item.subtitle ? el('span', { className: 'command-palette-item-subtitle', text: item.subtitle }) : null
    ].filter(Boolean))));
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
